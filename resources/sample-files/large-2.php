<?php

/**
 * Large file test - User management system
 * This file contains thousands of lines to test performance
 * Version 2.0 - Enhanced with new features
 */

namespace App\Services;

use App\Models\User;
use App\Events\UserCreated;
use App\Events\UserUpdated;
use App\Events\UserDeleted;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class UserService
{
    protected $userRepository;
    protected $notificationService;
    protected $validationService;
    protected $auditService;
    
    public function __construct(
        UserRepository $userRepository,
        NotificationService $notificationService,
        ValidationService $validationService,
        AuditService $auditService
    ) {
        $this->userRepository = $userRepository;
        $this->notificationService = $notificationService;
        $this->validationService = $validationService;
        $this->auditService = $auditService;
    }
    
    /**
     * Create a new user with enhanced validation
     */
    public function createUser(array $data): User
    {
        // Start transaction
        DB::beginTransaction();
        
        try {
            // Validate the input data
            $validated = $this->validationService->validateUserData($data);
            
            // Check if email already exists
            if ($this->userRepository->emailExists($validated['email'])) {
                throw new \Exception('Email already exists');
            }
            
            // Check username uniqueness
            if (isset($validated['username']) && $this->userRepository->usernameExists($validated['username'])) {
                throw new \Exception('Username already taken');
            }
            
            // Hash the password
            $validated['password'] = Hash::make($validated['password']);
            
            // Create the user
            $user = $this->userRepository->create($validated);
            
            // Create audit log
            $this->auditService->log('user_created', $user->id, $validated);
            
            // Fire event
            event(new UserCreated($user));
            
            // Send welcome email
            $this->notificationService->sendWelcomeEmail($user);
            
            // Log the creation
            Log::info('User created', ['user_id' => $user->id, 'email' => $user->email]);
            
            DB::commit();
            return $user;
        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }
    
    /**
     * Update an existing user with transaction support
     */
    public function updateUser(int $userId, array $data): User
    {
        DB::beginTransaction();
        
        try {
            // Find the user
            $user = $this->userRepository->findOrFail($userId);
            
            // Store old data for audit
            $oldData = $user->toArray();
            
            // Validate the input data
            $validated = $this->validationService->validateUserData($data, $user);
            
            // Check if email is being changed and already exists
            if (isset($validated['email']) && $validated['email'] !== $user->email) {
                if ($this->userRepository->emailExists($validated['email'])) {
                    throw new \Exception('Email already exists');
                }
            }
            
            // Hash password if provided
            if (isset($validated['password'])) {
                $validated['password'] = Hash::make($validated['password']);
                $validated['password_changed_at'] = now();
            }
            
            // Update the user
            $user = $this->userRepository->update($user, $validated);
            
            // Create audit log
            $this->auditService->log('user_updated', $user->id, [
                'old' => $oldData,
                'new' => $user->toArray()
            ]);
            
            // Fire event
            event(new UserUpdated($user, $oldData));
            
            // Clear cache
            Cache::forget('user.' . $userId);
            Cache::tags(['users'])->flush();
            
            // Log the update
            Log::info('User updated', ['user_id' => $user->id, 'changes' => array_keys($validated)]);
            
            DB::commit();
            return $user;
        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }
    
    /**
     * Delete a user with soft delete option
     */
    public function deleteUser(int $userId, bool $permanent = false): bool
    {
        DB::beginTransaction();
        
        try {
            // Find the user
            $user = $this->userRepository->findOrFail($userId);
            
            // Check if user can be deleted
            if (!$this->canDeleteUser($user)) {
                throw new \Exception('User cannot be deleted due to existing dependencies');
            }
            
            // Create audit log
            $this->auditService->log('user_deleted', $user->id, [
                'permanent' => $permanent,
                'deleted_by' => auth()->id()
            ]);
            
            // Delete the user
            if ($permanent) {
                $result = $this->userRepository->forceDelete($user);
            } else {
                $result = $this->userRepository->delete($user);
            }
            
            // Fire event
            event(new UserDeleted($user, $permanent));
            
            // Clear cache
            Cache::forget('user.' . $userId);
            Cache::tags(['users'])->flush();
            
            // Log the deletion
            Log::info('User deleted', [
                'user_id' => $userId,
                'permanent' => $permanent,
                'deleted_by' => auth()->id()
            ]);
            
            DB::commit();
            return $result;
        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }
    
    /**
     * Find a user by ID with caching
     */
    public function findUser(int $userId): ?User
    {
        return Cache::tags(['users'])->remember('user.' . $userId, 3600, function () use ($userId) {
            return $this->userRepository->find($userId);
        });
    }
    
    /**
     * Find a user by email
     */
    public function findUserByEmail(string $email): ?User
    {
        return $this->userRepository->findByEmail($email);
    }
    
    /**
     * Get all users with pagination and filtering
     */
    public function getAllUsers(int $perPage = 15, array $filters = [], string $sortBy = 'created_at', string $sortOrder = 'desc')
    {
        return $this->userRepository->paginate($perPage, $filters, $sortBy, $sortOrder);
    }
    
    /**
     * Search users with advanced options
     */
    public function searchUsers(string $query, int $limit = 10, array $searchIn = ['name', 'email'])
    {
        return $this->userRepository->search($query, $limit, $searchIn);
    }
    
    /**
     * Get user statistics with caching
     */
    public function getUserStatistics(int $userId): array
    {
        return Cache::tags(['users', 'statistics'])->remember(
            'user.stats.' . $userId, 
            1800, 
            function () use ($userId) {
                $user = $this->findUser($userId);
                
                if (!$user) {
                    throw new \Exception('User not found');
                }
                
                return [
                    'total_posts' => $user->posts()->count(),
                    'total_comments' => $user->comments()->count(),
                    'total_likes' => $user->likes()->count(),
                    'total_followers' => $user->followers()->count(),
                    'total_following' => $user->following()->count(),
                    'account_age_days' => $user->created_at->diffInDays(now()),
                    'last_login' => $user->last_login_at,
                    'profile_completion' => $this->calculateProfileCompletion($user),
                    'reputation_score' => $this->calculateReputationScore($user),
                ];
            }
        );
    }
    
    /**
     * Calculate profile completion percentage
     */
    protected function calculateProfileCompletion(User $user): int
    {
        $completion = 0;
        $fields = [
            'first_name' => 10,
            'last_name' => 10,
            'bio' => 20,
            'avatar' => 20,
            'phone' => 10,
            'address' => 10,
            'date_of_birth' => 10,
            'website' => 10,
        ];
        
        foreach ($fields as $field => $weight) {
            if (!empty($user->$field)) {
                $completion += $weight;
            }
        }
        
        return min($completion, 100);
    }
    
    /**
     * Calculate user reputation score
     */
    protected function calculateReputationScore(User $user): int
    {
        $score = 0;
        
        // Base score for account age
        $score += min($user->created_at->diffInDays(now()) * 2, 200);
        
        // Posts score
        $score += $user->posts()->count() * 10;
        
        // Comments score
        $score += $user->comments()->count() * 5;
        
        // Likes received score
        $score += $user->receivedLikes()->count() * 3;
        
        // Followers score
        $score += $user->followers()->count() * 2;
        
        // Penalties for violations
        $score -= $user->violations()->count() * 50;
        
        return max($score, 0);
    }
    
    /**
     * Check if user can be deleted
     */
    protected function canDeleteUser(User $user): bool
    {
        // System users cannot be deleted
        if ($user->is_system) {
            return false;
        }
        
        // Admin users cannot be deleted by non-admins
        if ($user->isAdmin() && !auth()->user()->isSuperAdmin()) {
            return false;
        }
        
        // Users with active subscriptions cannot be deleted
        if ($user->hasActiveSubscription()) {
            return false;
        }
        
        // Users with pending orders cannot be deleted
        if ($user->orders()->where('status', 'pending')->exists()) {
            return false;
        }
        
        // Users who are sole owners of organizations cannot be deleted
        if ($user->ownedOrganizations()->where('owner_count', 1)->exists()) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Authenticate user with rate limiting
     */
    public function authenticate(string $email, string $password, string $ipAddress): ?User
    {
        // Check rate limiting
        if ($this->getFailedLoginAttempts($email) >= 5) {
            throw new \Exception('Too many failed login attempts. Please try again later.');
        }
        
        $user = $this->findUserByEmail($email);
        
        if (!$user) {
            $this->recordLoginAttempt($email, false, $ipAddress);
            return null;
        }
        
        // Check if account is locked
        if ($this->isAccountLocked($user->id)) {
            throw new \Exception('Account is locked. Please contact support.');
        }
        
        // Check if account is active
        if (!$user->is_active) {
            throw new \Exception('Account is inactive. Please verify your email.');
        }
        
        if (!Hash::check($password, $user->password)) {
            $this->recordLoginAttempt($email, false, $ipAddress);
            return null;
        }
        
        // Update last login
        $this->userRepository->updateLastLogin($user, $ipAddress);
        
        // Record successful login
        $this->recordLoginAttempt($email, true, $ipAddress);
        
        // Clear failed attempts
        Cache::forget('failed_attempts.' . $email);
        
        return $user;
    }
    
    /**
     * Reset user password with security checks
     */
    public function resetPassword(int $userId, string $newPassword, string $oldPassword = null): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // If old password provided, verify it
        if ($oldPassword && !Hash::check($oldPassword, $user->password)) {
            throw new \Exception('Current password is incorrect');
        }
        
        // Check password history
        if ($this->isPasswordReused($user, $newPassword)) {
            throw new \Exception('Password has been used recently. Please choose a different password.');
        }
        
        // Update password
        $result = $this->userRepository->update($user, [
            'password' => Hash::make($newPassword),
            'password_changed_at' => now(),
        ]);
        
        // Store in password history
        $this->userRepository->addPasswordHistory($user->id, Hash::make($newPassword));
        
        // Send notification
        $this->notificationService->sendPasswordChangedNotification($user);
        
        // Terminate all sessions except current
        $this->terminateOtherSessions($user->id);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        // Create audit log
        $this->auditService->log('password_reset', $user->id);
        
        return $result !== false;
    }
    
    /**
     * Check if password has been used recently
     */
    protected function isPasswordReused(User $user, string $password): bool
    {
        $recentPasswords = $this->userRepository->getPasswordHistory($user->id, 5);
        
        foreach ($recentPasswords as $oldPassword) {
            if (Hash::check($password, $oldPassword->password_hash)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Terminate other sessions
     */
    protected function terminateOtherSessions(int $userId): void
    {
        $currentSessionId = session()->getId();
        $sessions = $this->getUserSessions($userId);
        
        foreach ($sessions as $session) {
            if ($session->id !== $currentSessionId) {
                $this->terminateSession($userId, $session->id);
            }
        }
    }
    
    /**
     * Activate user account with verification
     */
    public function activateUser(int $userId, string $token = null): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        if ($user->is_active) {
            return true;
        }
        
        // Verify token if provided
        if ($token && !$this->userRepository->verifyActivationToken($userId, $token)) {
            throw new \Exception('Invalid activation token');
        }
        
        // Activate the user
        $result = $this->userRepository->update($user, [
            'is_active' => true,
            'activated_at' => now(),
            'activation_token' => null,
        ]);
        
        // Send notification
        $this->notificationService->sendAccountActivatedNotification($user);
        
        // Create audit log
        $this->auditService->log('user_activated', $user->id);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        return $result !== false;
    }
    
    /**
     * Deactivate user account
     */
    public function deactivateUser(int $userId, string $reason = null): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        if (!$user->is_active) {
            return true;
        }
        
        // Deactivate the user
        $result = $this->userRepository->update($user, [
            'is_active' => false,
            'deactivated_at' => now(),
            'deactivation_reason' => $reason,
        ]);
        
        // Terminate all sessions
        $this->terminateAllSessions($userId);
        
        // Create audit log
        $this->auditService->log('user_deactivated', $user->id, ['reason' => $reason]);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        return $result !== false;
    }
    
    /**
     * Get user activity log with pagination
     */
    public function getUserActivityLog(int $userId, int $limit = 50, int $offset = 0)
    {
        return $this->userRepository->getActivityLog($userId, $limit, $offset);
    }
    
    /**
     * Update user preferences with validation
     */
    public function updateUserPreferences(int $userId, array $preferences): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Validate preferences
        $validated = $this->validationService->validatePreferences($preferences);
        
        // Update preferences
        $result = $this->userRepository->updatePreferences($user, $validated);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        Cache::forget('user.preferences.' . $userId);
        
        return $result;
    }
    
    /**
     * Get user notifications with filtering
     */
    public function getUserNotifications(int $userId, bool $unreadOnly = false, string $type = null)
    {
        return $this->userRepository->getNotifications($userId, $unreadOnly, $type);
    }
    
    /**
     * Mark notification as read
     */
    public function markNotificationAsRead(int $userId, int $notificationId): bool
    {
        return $this->userRepository->markNotificationAsRead($userId, $notificationId);
    }
    
    /**
     * Mark all notifications as read
     */
    public function markAllNotificationsAsRead(int $userId): bool
    {
        return $this->userRepository->markAllNotificationsAsRead($userId);
    }
    
    /**
     * Get user's friends with mutual friends count
     */
    public function getUserFriends(int $userId, int $limit = 20, bool $includeMutualCount = true)
    {
        $friends = $this->userRepository->getFriends($userId, $limit);
        
        if ($includeMutualCount && auth()->check()) {
            $currentUserId = auth()->id();
            foreach ($friends as $friend) {
                $friend->mutual_friends_count = $this->userRepository->getMutualFriendsCount(
                    $currentUserId, 
                    $friend->id
                );
            }
        }
        
        return $friends;
    }
    
    /**
     * Send friend request with validation
     */
    public function sendFriendRequest(int $fromUserId, int $toUserId, string $message = null): bool
    {
        // Validate users
        if ($fromUserId === $toUserId) {
            throw new \Exception('Cannot send friend request to yourself');
        }
        
        // Check if users exist
        $fromUser = $this->findUser($fromUserId);
        $toUser = $this->findUser($toUserId);
        
        if (!$fromUser || !$toUser) {
            throw new \Exception('User not found');
        }
        
        // Check if blocked
        if ($this->userRepository->isBlocked($toUserId, $fromUserId)) {
            throw new \Exception('Cannot send friend request to this user');
        }
        
        // Check if already friends
        if ($this->userRepository->areFriends($fromUserId, $toUserId)) {
            throw new \Exception('Users are already friends');
        }
        
        // Check if request already exists
        if ($this->userRepository->friendRequestExists($fromUserId, $toUserId)) {
            throw new \Exception('Friend request already sent');
        }
        
        // Send request
        $result = $this->userRepository->createFriendRequest($fromUserId, $toUserId, $message);
        
        // Send notification
        $this->notificationService->sendFriendRequestNotification($fromUser, $toUser, $message);
        
        return $result;
    }
    
    /**
     * Accept friend request
     */
    public function acceptFriendRequest(int $userId, int $requestId): bool
    {
        $request = $this->userRepository->getFriendRequest($requestId);
        
        if (!$request || $request->to_user_id !== $userId) {
            throw new \Exception('Friend request not found');
        }
        
        $result = $this->userRepository->acceptFriendRequest($userId, $requestId);
        
        if ($result) {
            // Send notification
            $this->notificationService->sendFriendRequestAcceptedNotification(
                $request->fromUser,
                $request->toUser
            );
            
            // Create audit log
            $this->auditService->log('friend_request_accepted', $userId, [
                'request_id' => $requestId,
                'from_user_id' => $request->from_user_id
            ]);
        }
        
        return $result;
    }
    
    /**
     * Reject friend request
     */
    public function rejectFriendRequest(int $userId, int $requestId): bool
    {
        $request = $this->userRepository->getFriendRequest($requestId);
        
        if (!$request || $request->to_user_id !== $userId) {
            throw new \Exception('Friend request not found');
        }
        
        return $this->userRepository->rejectFriendRequest($userId, $requestId);
    }
    
    /**
     * Remove friend with notification
     */
    public function removeFriend(int $userId, int $friendId): bool
    {
        if (!$this->userRepository->areFriends($userId, $friendId)) {
            throw new \Exception('Users are not friends');
        }
        
        $result = $this->userRepository->removeFriend($userId, $friendId);
        
        if ($result) {
            // Create audit log
            $this->auditService->log('friend_removed', $userId, ['friend_id' => $friendId]);
        }
        
        return $result;
    }
    
    /**
     * Block user with cascade effects
     */
    public function blockUser(int $userId, int $blockedUserId, string $reason = null): bool
    {
        // Validate
        if ($userId === $blockedUserId) {
            throw new \Exception('Cannot block yourself');
        }
        
        // Check if users exist
        $user = $this->findUser($userId);
        $blockedUser = $this->findUser($blockedUserId);
        
        if (!$user || !$blockedUser) {
            throw new \Exception('User not found');
        }
        
        // Block user
        $result = $this->userRepository->blockUser($userId, $blockedUserId, $reason);
        
        if ($result) {
            // Remove from friends if they were friends
            if ($this->userRepository->areFriends($userId, $blockedUserId)) {
                $this->userRepository->removeFriend($userId, $blockedUserId);
            }
            
            // Cancel any pending friend requests
            $this->userRepository->cancelFriendRequests($userId, $blockedUserId);
            
            // Unfollow each other
            $this->userRepository->unfollowUser($userId, $blockedUserId);
            $this->userRepository->unfollowUser($blockedUserId, $userId);
            
            // Create audit log
            $this->auditService->log('user_blocked', $userId, [
                'blocked_user_id' => $blockedUserId,
                'reason' => $reason
            ]);
        }
        
        return $result;
    }
    
    /**
     * Unblock user
     */
    public function unblockUser(int $userId, int $blockedUserId): bool
    {
        $result = $this->userRepository->unblockUser($userId, $blockedUserId);
        
        if ($result) {
            // Create audit log
            $this->auditService->log('user_unblocked', $userId, [
                'unblocked_user_id' => $blockedUserId
            ]);
        }
        
        return $result;
    }
    
    /**
     * Get blocked users with block reasons
     */
    public function getBlockedUsers(int $userId, int $limit = 50)
    {
        return $this->userRepository->getBlockedUsers($userId, $limit);
    }
    
    /**
     * Update user avatar with processing
     */
    public function updateUserAvatar(int $userId, $avatarFile): string
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Process and store avatar
        $avatarPath = $this->processAvatar($avatarFile);
        
        // Delete old avatar
        if ($user->avatar) {
            $this->deleteOldAvatar($user->avatar);
        }
        
        // Update user
        $this->userRepository->update($user, ['avatar' => $avatarPath]);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        // Create audit log
        $this->auditService->log('avatar_updated', $userId);
        
        return $avatarPath;
    }
    
    /**
     * Process avatar file with resizing
     */
    protected function processAvatar($file): string
    {
        // Validate file
        if (!$file->isValid()) {
            throw new \Exception('Invalid file');
        }
        
        // Check file type
        $allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (!in_array(strtolower($file->getClientOriginalExtension()), $allowedTypes)) {
            throw new \Exception('Invalid file type. Allowed types: ' . implode(', ', $allowedTypes));
        }
        
        // Check file size (max 10MB)
        if ($file->getSize() > 10 * 1024 * 1024) {
            throw new \Exception('File too large. Maximum size is 10MB.');
        }
        
        // Generate unique filename
        $filename = uniqid('avatar_') . '.' . $file->getClientOriginalExtension();
        
        // Store original
        $path = $file->storeAs('avatars/original', $filename, 'public');
        
        // Create resized versions
        $this->createAvatarSizes($file, $filename);
        
        return $path;
    }
    
    /**
     * Create multiple avatar sizes
     */
    protected function createAvatarSizes($file, string $filename): void
    {
        $sizes = [
            'large' => 500,
            'medium' => 200,
            'small' => 100,
            'thumbnail' => 50,
        ];
        
        foreach ($sizes as $name => $size) {
            // Resize and store
            // Implementation would use image manipulation library
        }
    }
    
    /**
     * Delete old avatar files
     */
    protected function deleteOldAvatar(string $avatarPath): void
    {
        // Delete original and all sizes
        // Implementation would delete files from storage
    }
    
    /**
     * Get user's posts with eager loading
     */
    public function getUserPosts(int $userId, int $limit = 10, bool $withComments = false)
    {
        $query = $this->userRepository->getPostsQuery($userId);
        
        if ($withComments) {
            $query->with(['comments' => function ($q) {
                $q->latest()->limit(5);
            }]);
        }
        
        return $query->latest()->limit($limit)->get();
    }
    
    /**
     * Get user's comments
     */
    public function getUserComments(int $userId, int $limit = 10)
    {
        return $this->userRepository->getComments($userId, $limit);
    }
    
    /**
     * Get user's likes
     */
    public function getUserLikes(int $userId, int $limit = 10)
    {
        return $this->userRepository->getLikes($userId, $limit);
    }
    
    /**
     * Get user's followers with pagination
     */
    public function getUserFollowers(int $userId, int $page = 1, int $perPage = 20)
    {
        return $this->userRepository->getFollowers($userId)
            ->paginate($perPage, ['*'], 'page', $page);
    }
    
    /**
     * Get users that user is following
     */
    public function getUserFollowing(int $userId, int $page = 1, int $perPage = 20)
    {
        return $this->userRepository->getFollowing($userId)
            ->paginate($perPage, ['*'], 'page', $page);
    }
    
    /**
     * Follow user with notifications
     */
    public function followUser(int $userId, int $targetUserId): bool
    {
        // Validate
        if ($userId === $targetUserId) {
            throw new \Exception('Cannot follow yourself');
        }
        
        // Check if users exist
        $user = $this->findUser($userId);
        $targetUser = $this->findUser($targetUserId);
        
        if (!$user || !$targetUser) {
            throw new \Exception('User not found');
        }
        
        // Check if blocked
        if ($this->userRepository->isBlocked($targetUserId, $userId)) {
            throw new \Exception('Cannot follow this user');
        }
        
        // Check if already following
        if ($this->userRepository->isFollowing($userId, $targetUserId)) {
            return true;
        }
        
        // Follow user
        $result = $this->userRepository->followUser($userId, $targetUserId);
        
        if ($result) {
            // Send notification
            $this->notificationService->sendFollowNotification($user, $targetUser);
            
            // Update follower counts in cache
            Cache::forget('user.stats.' . $userId);
            Cache::forget('user.stats.' . $targetUserId);
        }
        
        return $result;
    }
    
    /**
     * Unfollow user
     */
    public function unfollowUser(int $userId, int $targetUserId): bool
    {
        $result = $this->userRepository->unfollowUser($userId, $targetUserId);
        
        if ($result) {
            // Update follower counts in cache
            Cache::forget('user.stats.' . $userId);
            Cache::forget('user.stats.' . $targetUserId);
        }
        
        return $result;
    }
    
    /**
     * Get user's subscription details
     */
    public function getUserSubscription(int $userId)
    {
        $subscription = $this->userRepository->getActiveSubscription($userId);
        
        if ($subscription) {
            // Add additional details
            $subscription->days_remaining = $subscription->expires_at->diffInDays(now());
            $subscription->is_expiring_soon = $subscription->days_remaining <= 7;
        }
        
        return $subscription;
    }
    
    /**
     * Subscribe user to plan
     */
    public function subscribeUser(int $userId, string $planId, array $paymentDetails): bool
    {
        DB::beginTransaction();
        
        try {
            $user = $this->findUser($userId);
            
            if (!$user) {
                throw new \Exception('User not found');
            }
            
            // Check if already subscribed
            if ($user->hasActiveSubscription()) {
                throw new \Exception('User already has an active subscription');
            }
            
            // Process payment
            $paymentResult = $this->processPayment($paymentDetails);
            
            if (!$paymentResult['success']) {
                throw new \Exception('Payment failed: ' . $paymentResult['message']);
            }
            
            // Create subscription
            $subscription = $this->userRepository->createSubscription(
                $userId, 
                $planId, 
                $paymentResult['transaction_id']
            );
            
            // Update user role based on plan
            $this->updateUserRoleForPlan($user, $planId);
            
            // Send notification
            $this->notificationService->sendSubscriptionNotification($user, $subscription);
            
            // Create audit log
            $this->auditService->log('subscription_created', $userId, [
                'plan_id' => $planId,
                'transaction_id' => $paymentResult['transaction_id']
            ]);
            
            DB::commit();
            return true;
        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }
    
    /**
     * Cancel user subscription
     */
    public function cancelSubscription(int $userId, string $reason = null): bool
    {
        DB::beginTransaction();
        
        try {
            $subscription = $this->getUserSubscription($userId);
            
            if (!$subscription) {
                throw new \Exception('No active subscription found');
            }
            
            // Cancel subscription
            $result = $this->userRepository->cancelSubscription($subscription->id, $reason);
            
            if ($result) {
                // Update user role
                $user = $this->findUser($userId);
                $this->updateUser($userId, ['role' => 'user']);
                
                // Send notification
                $this->notificationService->sendSubscriptionCancellationNotification($user, $subscription);
                
                // Create audit log
                $this->auditService->log('subscription_cancelled', $userId, [
                    'subscription_id' => $subscription->id,
                    'reason' => $reason
                ]);
            }
            
            DB::commit();
            return $result;
        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }
    
    /**
     * Update user role based on subscription plan
     */
    protected function updateUserRoleForPlan(User $user, string $planId): void
    {
        $roleMapping = [
            'basic' => 'subscriber',
            'pro' => 'pro_user',
            'enterprise' => 'enterprise_user',
        ];
        
        if (isset($roleMapping[$planId])) {
            $this->updateUser($user->id, ['role' => $roleMapping[$planId]]);
        }
    }
    
    /**
     * Process payment (enhanced mock implementation)
     */
    protected function processPayment(array $paymentDetails): array
    {
        // Validate payment details
        if (!isset($paymentDetails['card_number']) || !isset($paymentDetails['amount'])) {
            return [
                'success' => false,
                'message' => 'Invalid payment details',
            ];
        }
        
        // Mock payment processing
        // In production, this would integrate with payment gateway
        
        // Simulate processing delay
        usleep(500000); // 0.5 seconds
        
        // Simulate success/failure
        $success = rand(1, 100) > 5; // 95% success rate
        
        return [
            'success' => $success,
            'transaction_id' => $success ? uniqid('txn_') : null,
            'message' => $success ? 'Payment processed successfully' : 'Payment declined',
            'amount' => $paymentDetails['amount'],
            'currency' => $paymentDetails['currency'] ?? 'USD',
        ];
    }
    
    /**
     * Export user data in multiple formats
     */
    public function exportUserData(int $userId, string $format = 'json'): array
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        $data = [
            'exported_at' => now()->toIso8601String(),
            'format' => $format,
            'profile' => $user->makeVisible(['email', 'phone'])->toArray(),
            'posts' => $this->getUserPosts($userId, 1000)->toArray(),
            'comments' => $this->getUserComments($userId, 1000)->toArray(),
            'likes' => $this->getUserLikes($userId, 1000)->toArray(),
            'friends' => $this->getUserFriends($userId, 1000, false)->toArray(),
            'followers' => $this->getUserFollowers($userId, 1, 1000)->items(),
            'following' => $this->getUserFollowing($userId, 1, 1000)->items(),
            'notifications' => $this->getUserNotifications($userId)->toArray(),
            'activity_log' => $this->getUserActivityLog($userId, 1000)->toArray(),
            'preferences' => $this->getUserPreferences($userId),
        ];
        
        // Create audit log
        $this->auditService->log('data_exported', $userId, ['format' => $format]);
        
        return $data;
    }
    
    /**
     * Import user data with validation
     */
    public function importUserData(array $data): User
    {
        DB::beginTransaction();
        
        try {
            // Validate data structure
            if (!isset($data['profile']) || !isset($data['profile']['email'])) {
                throw new \Exception('Invalid data format');
            }
            
            // Validate data integrity
            if (isset($data['checksum']) && !$this->verifyDataChecksum($data)) {
                throw new \Exception('Data integrity check failed');
            }
            
            // Create or update user
            $user = $this->findUserByEmail($data['profile']['email']);
            
            if ($user) {
                // Update existing user
                $user = $this->updateUser($user->id, $data['profile']);
            } else {
                // Create new user
                $user = $this->createUser($data['profile']);
            }
            
            // Import related data
            if (isset($data['posts'])) {
                $this->importUserPosts($user->id, $data['posts']);
            }
            
            if (isset($data['comments'])) {
                $this->importUserComments($user->id, $data['comments']);
            }
            
            if (isset($data['preferences'])) {
                $this->updateUserPreferences($user->id, $data['preferences']);
            }
            
            // Create audit log
            $this->auditService->log('data_imported', $user->id, [
                'imported_at' => now(),
                'data_types' => array_keys($data)
            ]);
            
            DB::commit();
            return $user;
        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }
    
    /**
     * Verify data checksum
     */
    protected function verifyDataChecksum(array $data): bool
    {
        $checksum = $data['checksum'];
        unset($data['checksum']);
        
        $calculatedChecksum = hash('sha256', json_encode($data));
        
        return $checksum === $calculatedChecksum;
    }
    
    /**
     * Import user posts
     */
    protected function importUserPosts(int $userId, array $posts): void
    {
        foreach ($posts as $postData) {
            // Skip if post already exists
            if (isset($postData['id']) && $this->userRepository->postExists($postData['id'])) {
                continue;
            }
            
            $this->userRepository->createPost($userId, $postData);
        }
    }
    
    /**
     * Import user comments
     */
    protected function importUserComments(int $userId, array $comments): void
    {
        foreach ($comments as $commentData) {
            // Skip if comment already exists
            if (isset($commentData['id']) && $this->userRepository->commentExists($commentData['id'])) {
                continue;
            }
            
            $this->userRepository->createComment($userId, $commentData);
        }
    }
    
    /**
     * Merge duplicate users with comprehensive data transfer
     */
    public function mergeUsers(int $primaryUserId, int $secondaryUserId): bool
    {
        DB::beginTransaction();
        
        try {
            $primaryUser = $this->findUser($primaryUserId);
            $secondaryUser = $this->findUser($secondaryUserId);
            
            if (!$primaryUser || !$secondaryUser) {
                throw new \Exception('User not found');
            }
            
            // Create backup of secondary user data
            $backupData = $this->exportUserData($secondaryUserId);
            $this->userRepository->storeUserBackup($secondaryUserId, $backupData);
            
            // Transfer all data from secondary to primary
            $this->userRepository->transferPosts($secondaryUserId, $primaryUserId);
            $this->userRepository->transferComments($secondaryUserId, $primaryUserId);
            $this->userRepository->transferLikes($secondaryUserId, $primaryUserId);
            $this->userRepository->transferFriends($secondaryUserId, $primaryUserId);
            $this->userRepository->transferFollowers($secondaryUserId, $primaryUserId);
            $this->userRepository->transferNotifications($secondaryUserId, $primaryUserId);
            $this->userRepository->transferSubscriptions($secondaryUserId, $primaryUserId);
            
            // Merge profile data
            $this->mergeProfileData($primaryUser, $secondaryUser);
            
            // Delete secondary user
            $this->deleteUser($secondaryUserId, true);
            
            // Create audit log
            $this->auditService->log('users_merged', $primaryUserId, [
                'secondary_user_id' => $secondaryUserId,
                'backup_id' => $backupData['id'] ?? null
            ]);
            
            // Clear cache
            Cache::tags(['users'])->flush();
            
            DB::commit();
            return true;
        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }
    
    /**
     * Merge profile data from secondary user to primary
     */
    protected function mergeProfileData(User $primary, User $secondary): void
    {
        $fieldsToMerge = ['bio', 'website', 'phone', 'address'];
        $updates = [];
        
        foreach ($fieldsToMerge as $field) {
            if (empty($primary->$field) && !empty($secondary->$field)) {
                $updates[$field] = $secondary->$field;
            }
        }
        
        if (!empty($updates)) {
            $this->userRepository->update($primary, $updates);
        }
    }
    
    /**
     * Verify user email with token
     */
    public function verifyEmail(int $userId, string $token): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        if ($user->email_verified_at) {
            return true;
        }
        
        // Verify token
        if (!$this->userRepository->verifyEmailToken($userId, $token)) {
            throw new \Exception('Invalid or expired verification token');
        }
        
        // Mark email as verified
        $result = $this->userRepository->update($user, [
            'email_verified_at' => now(),
            'email_verification_token' => null,
        ]);
        
        if ($result) {
            // Send notification
            $this->notificationService->sendEmailVerifiedNotification($user);
            
            // Create audit log
            $this->auditService->log('email_verified', $userId);
            
            // Clear cache
            Cache::forget('user.' . $userId);
        }
        
        return $result !== false;
    }
    
    /**
     * Send verification email
     */
    public function sendVerificationEmail(int $userId): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        if ($user->email_verified_at) {
            return true;
        }
        
        // Check rate limiting
        $key = 'verification_email.' . $userId;
        if (Cache::has($key)) {
            throw new \Exception('Please wait before requesting another verification email');
        }
        
        // Generate token
        $token = $this->userRepository->generateEmailVerificationToken($userId);
        
        // Send email
        $this->notificationService->sendVerificationEmail($user, $token);
        
        // Set rate limit
        Cache::put($key, true, 300); // 5 minutes
        
        return true;
    }
    
    /**
     * Update user role with validation
     */
    public function updateUserRole(int $userId, string $role): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Validate role
        $validRoles = config('auth.roles', ['user', 'moderator', 'admin']);
        if (!in_array($role, $validRoles)) {
            throw new \Exception('Invalid role: ' . $role);
        }
        
        // Check permissions
        if (!auth()->user()->canAssignRole($role)) {
            throw new \Exception('Insufficient permissions to assign this role');
        }
        
        $oldRole = $user->role;
        
        // Update role
        $result = $this->userRepository->update($user, ['role' => $role]);
        
        if ($result) {
            // Update permissions
            $this->updateUserPermissions($user, $role);
            
            // Send notification
            $this->notificationService->sendRoleChangedNotification($user, $oldRole, $role);
            
            // Create audit log
            $this->auditService->log('role_updated', $userId, [
                'old_role' => $oldRole,
                'new_role' => $role,
                'updated_by' => auth()->id()
            ]);
            
            // Clear cache
            Cache::forget('user.' . $userId);
            Cache::forget('user.permissions.' . $userId);
        }
        
        return $result !== false;
    }
    
    /**
     * Update user permissions based on role
     */
    protected function updateUserPermissions(User $user, string $role): void
    {
        // Get permissions for role
        $permissions = config("auth.role_permissions.{$role}", []);
        
        // Sync permissions
        $this->userRepository->syncPermissions($user->id, $permissions);
    }
    
    /**
     * Get users by role with caching
     */
    public function getUsersByRole(string $role, int $limit = 100)
    {
        return Cache::tags(['users', 'roles'])->remember(
            "users.role.{$role}",
            3600,
            function () use ($role, $limit) {
                return $this->userRepository->getByRole($role, $limit);
            }
        );
    }
    
    /**
     * Ban user with expiry
     */
    public function banUser(int $userId, string $reason, $duration = null): bool
    {
        DB::beginTransaction();
        
        try {
            $user = $this->findUser($userId);
            
            if (!$user) {
                throw new \Exception('User not found');
            }
            
            // Check permissions
            if (!auth()->user()->canBanUser($user)) {
                throw new \Exception('Insufficient permissions to ban this user');
            }
            
            // Calculate ban expiry
            $bannedUntil = $duration ? now()->addDays($duration) : null;
            
            // Ban user
            $result = $this->userRepository->update($user, [
                'is_banned' => true,
                'ban_reason' => $reason,
                'banned_at' => now(),
                'banned_until' => $bannedUntil,
                'banned_by' => auth()->id(),
            ]);
            
            if ($result) {
                // Terminate all sessions
                $this->terminateAllSessions($userId);
                
                // Send notification
                $this->notificationService->sendBanNotification($user, $reason, $bannedUntil);
                
                // Create audit log
                $this->auditService->log('user_banned', $userId, [
                    'reason' => $reason,
                    'duration' => $duration,
                    'banned_by' => auth()->id()
                ]);
                
                // Clear cache
                Cache::forget('user.' . $userId);
            }
            
            DB::commit();
            return $result !== false;
        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }
    
    /**
     * Unban user
     */
    public function unbanUser(int $userId): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        if (!$user->is_banned) {
            return true;
        }
        
        // Unban user
        $result = $this->userRepository->update($user, [
            'is_banned' => false,
            'ban_reason' => null,
            'banned_at' => null,
            'banned_until' => null,
            'banned_by' => null,
            'unbanned_at' => now(),
            'unbanned_by' => auth()->id(),
        ]);
        
        if ($result) {
            // Send notification
            $this->notificationService->sendUnbanNotification($user);
            
            // Create audit log
            $this->auditService->log('user_unbanned', $userId, [
                'unbanned_by' => auth()->id()
            ]);
            
            // Clear cache
            Cache::forget('user.' . $userId);
        }
        
        return $result !== false;
    }
    
    /**
     * Get banned users with pagination
     */
    public function getBannedUsers(int $page = 1, int $perPage = 50)
    {
        return $this->userRepository->getBannedUsers()
            ->with('bannedBy')
            ->paginate($perPage, ['*'], 'page', $page);
    }
    
    /**
     * Check if user is online with grace period
     */
    public function isUserOnline(int $userId): bool
    {
        $lastActivity = Cache::get('user.last_activity.' . $userId);
        
        if (!$lastActivity) {
            return false;
        }
        
        // Consider online if active within last 5 minutes
        return now()->diffInMinutes($lastActivity) <= 5;
    }
    
    /**
     * Update user online status with timestamp
     */
    public function updateOnlineStatus(int $userId, bool $online = true): void
    {
        if ($online) {
            Cache::put('user.last_activity.' . $userId, now(), 600); // 10 minutes
            Cache::put('user.online.' . $userId, true, 300); // 5 minutes
        } else {
            Cache::forget('user.online.' . $userId);
            Cache::forget('user.last_activity.' . $userId);
        }
    }
    
    /**
     * Get online users with details
     */
    public function getOnlineUsers(int $limit = 100)
    {
        // In production, use Redis SCAN for better performance
        $onlineUserIds = [];
        
        // Get recent active users
        $recentUsers = $this->userRepository->getActiveSince(now()->subMinutes(5), $limit * 2);
        
        foreach ($recentUsers as $user) {
            if ($this->isUserOnline($user->id)) {
                $onlineUserIds[] = $user->id;
                
                if (count($onlineUserIds) >= $limit) {
                    break;
                }
            }
        }
        
        return $this->userRepository->getByIds($onlineUserIds)
            ->map(function ($user) {
                $user->last_activity = Cache::get('user.last_activity.' . $user->id);
                return $user;
            });
    }
    
    /**
     * Generate comprehensive user report
     */
    public function generateUserReport(int $userId, string $type = 'full', array $options = []): array
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        $report = [
            'report_id' => uniqid('report_'),
            'user_id' => $userId,
            'generated_at' => now()->toIso8601String(),
            'generated_by' => auth()->id(),
            'type' => $type,
            'user' => $user->toArray(),
        ];
        
        switch ($type) {
            case 'activity':
                $report['activity'] = $this->generateActivityReport($user, $options);
                break;
                
            case 'social':
                $report['social'] = $this->generateSocialReport($user, $options);
                break;
                
            case 'security':
                $report['security'] = $this->generateSecurityReport($user, $options);
                break;
                
            case 'financial':
                $report['financial'] = $this->generateFinancialReport($user, $options);
                break;
                
            case 'full':
            default:
                $report['statistics'] = $this->getUserStatistics($userId);
                $report['activity'] = $this->generateActivityReport($user, $options);
                $report['social'] = $this->generateSocialReport($user, $options);
                $report['security'] = $this->generateSecurityReport($user, $options);
                if (auth()->user()->canViewFinancialData()) {
                    $report['financial'] = $this->generateFinancialReport($user, $options);
                }
                break;
        }
        
        // Store report
        $this->userRepository->storeReport($report);
        
        // Create audit log
        $this->auditService->log('report_generated', $userId, [
            'report_id' => $report['report_id'],
            'type' => $type
        ]);
        
        return $report;
    }
    
    /**
     * Generate activity report section
     */
    protected function generateActivityReport(User $user, array $options): array
    {
        $period = $options['period'] ?? 30; // days
        $startDate = now()->subDays($period);
        
        return [
            'posts' => [
                'total' => $user->posts()->count(),
                'in_period' => $user->posts()->where('created_at', '>=', $startDate)->count(),
                'avg_per_day' => round($user->posts()->where('created_at', '>=', $startDate)->count() / $period, 2),
            ],
            'comments' => [
                'total' => $user->comments()->count(),
                'in_period' => $user->comments()->where('created_at', '>=', $startDate)->count(),
                'avg_per_day' => round($user->comments()->where('created_at', '>=', $startDate)->count() / $period, 2),
            ],
            'likes' => [
                'given' => $user->likes()->count(),
                'received' => $user->receivedLikes()->count(),
                'ratio' => $user->likes()->count() > 0 ? round($user->receivedLikes()->count() / $user->likes()->count(), 2) : 0,
            ],
            'login_count' => $this->userRepository->getLoginCount($user->id, $startDate),
            'last_activity' => $this->userRepository->getLastActivity($user->id),
            'most_active_hour' => $this->userRepository->getMostActiveHour($user->id),
            'streak' => $this->calculateActivityStreak($user),
        ];
    }
    
    /**
     * Generate social report section
     */
    protected function generateSocialReport(User $user, array $options): array
    {
        return [
            'friends' => [
                'total' => $user->friends()->count(),
                'mutual_with_current_user' => auth()->check() ? 
                    $this->userRepository->getMutualFriendsCount(auth()->id(), $user->id) : 0,
                'recent' => $user->friends()->latest('pivot.created_at')->limit(5)->get(['id', 'name']),
            ],
            'followers' => [
                'total' => $user->followers()->count(),
                'growth_rate' => $this->calculateFollowerGrowthRate($user),
                'top_followers' => $this->getTopFollowers($user->id, 5),
            ],
            'following' => [
                'total' => $user->following()->count(),
                'categories' => $this->categorizeFollowing($user),
            ],
            'blocked_users' => $this->getBlockedUsers($user->id)->count(),
            'engagement_rate' => $this->calculateEngagementRate($user),
            'influence_score' => $this->calculateInfluenceScore($user),
        ];
    }
    
    /**
     * Generate security report section
     */
    protected function generateSecurityReport(User $user, array $options): array
    {
        return [
            'account_status' => [
                'is_active' => $user->is_active,
                'is_banned' => $user->is_banned,
                'is_verified' => !is_null($user->email_verified_at),
                'two_factor_enabled' => $user->two_factor_enabled,
            ],
            'password_security' => [
                'last_changed' => $user->password_changed_at,
                'requires_change' => $this->requiresPasswordChange($user),
                'strength_score' => $this->assessPasswordStrength($user),
            ],
            'login_security' => [
                'failed_attempts' => $this->getFailedLoginAttempts($user->email, 30 * 24 * 60), // 30 days
                'suspicious_logins' => $this->getSuspiciousLogins($user->id),
                'active_sessions' => $this->getUserSessions($user->id)->count(),
            ],
            'api_access' => [
                'tokens_count' => $this->getUserApiTokens($user->id)->count(),
                'last_token_used' => $this->getLastApiTokenUsage($user->id),
            ],
            'security_events' => $this->getSecurityEvents($user->id, 10),
        ];
    }
    
    /**
     * Generate financial report section
     */
    protected function generateFinancialReport(User $user, array $options): array
    {
        return [
            'subscription' => [
                'current' => $this->getUserSubscription($user->id),
                'history' => $this->userRepository->getSubscriptionHistory($user->id),
                'total_spent' => $this->userRepository->getTotalSpent($user->id),
            ],
            'transactions' => [
                'recent' => $this->userRepository->getRecentTransactions($user->id, 10),
                'summary' => $this->generateTransactionSummary($user->id),
            ],
            'credits' => [
                'balance' => $user->credits_balance ?? 0,
                'earned' => $this->userRepository->getTotalCreditsEarned($user->id),
                'spent' => $this->userRepository->getTotalCreditsSpent($user->id),
            ],
            'referrals' => [
                'count' => $this->userRepository->getReferralCount($user->id),
                'earnings' => $this->userRepository->getReferralEarnings($user->id),
            ],
        ];
    }
    
    /**
     * Calculate activity streak
     */
    protected function calculateActivityStreak(User $user): int
    {
        $streak = 0;
        $date = now()->startOfDay();
        
        while (true) {
            $hasActivity = $this->userRepository->hasActivityOnDate($user->id, $date);
            
            if (!$hasActivity) {
                break;
            }
            
            $streak++;
            $date = $date->subDay();
        }
        
        return $streak;
    }
    
    /**
     * Calculate follower growth rate
     */
    protected function calculateFollowerGrowthRate(User $user): float
    {
        $currentCount = $user->followers()->count();
        $countLastMonth = $this->userRepository->getFollowerCountOnDate(
            $user->id, 
            now()->subMonth()
        );
        
        if ($countLastMonth == 0) {
            return $currentCount > 0 ? 100.0 : 0.0;
        }
        
        return round((($currentCount - $countLastMonth) / $countLastMonth) * 100, 2);
    }
    
    /**
     * Get top followers by influence
     */
    protected function getTopFollowers(int $userId, int $limit): array
    {
        return $this->userRepository->getFollowers($userId)
            ->withCount(['followers', 'posts'])
            ->orderByDesc('followers_count')
            ->limit($limit)
            ->get()
            ->map(function ($follower) {
                return [
                    'id' => $follower->id,
                    'name' => $follower->name,
                    'followers_count' => $follower->followers_count,
                    'influence_score' => $this->calculateInfluenceScore($follower),
                ];
            })
            ->toArray();
    }
    
    /**
     * Categorize who user is following
     */
    protected function categorizeFollowing(User $user): array
    {
        $following = $user->following()->withCount(['posts', 'followers'])->get();
        
        return [
            'influencers' => $following->where('followers_count', '>', 1000)->count(),
            'active_users' => $following->where('posts_count', '>', 50)->count(),
            'new_users' => $following->where('created_at', '>', now()->subDays(30))->count(),
            'inactive_users' => $following->filter(function ($u) {
                return !$this->userRepository->hasActivitySince($u->id, now()->subDays(30));
            })->count(),
        ];
    }
    
    /**
     * Calculate engagement rate
     */
    protected function calculateEngagementRate(User $user): float
    {
        $totalPosts = $user->posts()->count();
        
        if ($totalPosts == 0) {
            return 0.0;
        }
        
        $totalEngagements = $user->posts()
            ->withCount(['comments', 'likes'])
            ->get()
            ->sum(function ($post) {
                return $post->comments_count + $post->likes_count;
            });
        
        $followerCount = $user->followers()->count() ?: 1;
        
        return round(($totalEngagements / ($totalPosts * $followerCount)) * 100, 2);
    }
    
    /**
     * Calculate influence score
     */
    protected function calculateInfluenceScore(User $user): int
    {
        $score = 0;
        
        // Follower score (weighted)
        $followerCount = $user->followers()->count();
        $score += min($followerCount * 2, 1000);
        
        // Engagement score
        $engagementRate = $this->calculateEngagementRate($user);
        $score += $engagementRate * 10;
        
        // Content score
        $score += min($user->posts()->count() * 5, 500);
        
        // Reputation score
        $score += $this->calculateReputationScore($user) / 10;
        
        // Account age bonus
        $accountAge = $user->created_at->diffInDays(now());
        $score += min($accountAge, 365);
        
        return (int) $score;
    }
    
    /**
     * Check if password change is required
     */
    protected function requiresPasswordChange(User $user): bool
    {
        if (!$user->password_changed_at) {
            return true;
        }
        
        $daysSinceChange = $user->password_changed_at->diffInDays(now());
        $maxPasswordAge = config('auth.password_expiry_days', 90);
        
        return $daysSinceChange >= $maxPasswordAge;
    }
    
    /**
     * Assess password strength (mock implementation)
     */
    protected function assessPasswordStrength(User $user): int
    {
        // In production, this would analyze password complexity
        // For now, return a mock score
        return rand(60, 100);
    }
    
    /**
     * Get suspicious login attempts
     */
    protected function getSuspiciousLogins(int $userId): array
    {
        return $this->userRepository->getLoginHistory($userId)
            ->filter(function ($login) {
                // Check for suspicious patterns
                return $this->isLoginSuspicious($login);
            })
            ->take(10)
            ->toArray();
    }
    
    /**
     * Check if login is suspicious
     */
    protected function isLoginSuspicious($login): bool
    {
        // Check for unusual location
        if ($login->country !== $login->user->usual_country) {
            return true;
        }
        
        // Check for unusual time
        $hour = $login->created_at->hour;
        if ($hour >= 2 && $hour <= 5) {
            return true;
        }
        
        // Check for rapid location changes
        // Implementation would check previous login location
        
        return false;
    }
    
    /**
     * Get last API token usage
     */
    protected function getLastApiTokenUsage(int $userId): ?string
    {
        $lastUsage = $this->userRepository->getLastApiTokenUsage($userId);
        
        return $lastUsage ? $lastUsage->toIso8601String() : null;
    }
    
    /**
     * Get security events
     */
    protected function getSecurityEvents(int $userId, int $limit): array
    {
        return $this->userRepository->getSecurityEvents($userId)
            ->limit($limit)
            ->get()
            ->map(function ($event) {
                return [
                    'type' => $event->type,
                    'description' => $event->description,
                    'severity' => $event->severity,
                    'occurred_at' => $event->created_at->toIso8601String(),
                    'ip_address' => $event->ip_address,
                ];
            })
            ->toArray();
    }
    
    /**
     * Generate transaction summary
     */
    protected function generateTransactionSummary(int $userId): array
    {
        $transactions = $this->userRepository->getAllTransactions($userId);
        
        return [
            'total_count' => $transactions->count(),
            'total_amount' => $transactions->sum('amount'),
            'average_amount' => $transactions->avg('amount'),
            'by_type' => $transactions->groupBy('type')->map->count(),
            'by_status' => $transactions->groupBy('status')->map->count(),
        ];
    }
    
    /**
     * Bulk update users with validation
     */
    public function bulkUpdateUsers(array $userIds, array $data): int
    {
        $updated = 0;
        $errors = [];
        
        // Validate update data
        try {
            $validated = $this->validationService->validateBulkUpdateData($data);
        } catch (\Exception $e) {
            throw new \Exception('Invalid update data: ' . $e->getMessage());
        }
        
        DB::beginTransaction();
        
        try {
            foreach ($userIds as $userId) {
                try {
                    $this->updateUser($userId, $validated);
                    $updated++;
                } catch (\Exception $e) {
                    $errors[] = [
                        'user_id' => $userId,
                        'error' => $e->getMessage()
                    ];
                    
                    Log::error('Failed to update user in bulk operation', [
                        'user_id' => $userId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
            
            // Create audit log
            $this->auditService->log('bulk_update', null, [
                'total_users' => count($userIds),
                'updated' => $updated,
                'failed' => count($errors),
                'updates' => array_keys($validated),
            ]);
            
            DB::commit();
        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
        
        if (!empty($errors)) {
            Log::warning('Bulk update completed with errors', [
                'errors' => $errors
            ]);
        }
        
        return $updated;
    }
    
    /**
     * Bulk delete users with safety checks
     */
    public function bulkDeleteUsers(array $userIds, bool $permanent = false): int
    {
        $deleted = 0;
        $errors = [];
        
        DB::beginTransaction();
        
        try {
            foreach ($userIds as $userId) {
                try {
                    if ($this->canDeleteUser($this->findUser($userId))) {
                        $this->deleteUser($userId, $permanent);
                        $deleted++;
                    } else {
                        $errors[] = [
                            'user_id' => $userId,
                            'error' => 'User cannot be deleted'
                        ];
                    }
                } catch (\Exception $e) {
                    $errors[] = [
                        'user_id' => $userId,
                        'error' => $e->getMessage()
                    ];
                    
                    Log::error('Failed to delete user in bulk operation', [
                        'user_id' => $userId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
            
            // Create audit log
            $this->auditService->log('bulk_delete', null, [
                'total_users' => count($userIds),
                'deleted' => $deleted,
                'failed' => count($errors),
                'permanent' => $permanent,
            ]);
            
            DB::commit();
        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
        
        if (!empty($errors)) {
            Log::warning('Bulk delete completed with errors', [
                'errors' => $errors
            ]);
        }
        
        return $deleted;
    }
    
    /**
     * Get users created between dates
     */
    public function getUsersCreatedBetween($startDate, $endDate, int $limit = null)
    {
        $query = $this->userRepository->getCreatedBetween($startDate, $endDate);
        
        if ($limit) {
            $query->limit($limit);
        }
        
        return $query->get();
    }
    
    /**
     * Get inactive users with details
     */
    public function getInactiveUsers(int $days = 30, int $limit = 100)
    {
        $date = now()->subDays($days);
        return $this->userRepository->getInactiveSince($date, $limit)
            ->map(function ($user) use ($date) {
                $user->days_inactive = $date->diffInDays($user->last_activity_at ?: $user->created_at);
                return $user;
            });
    }
    
    /**
     * Send reactivation emails to inactive users
     */
    public function sendReactivationEmails(int $days = 30, int $limit = 1000): int
    {
        $inactiveUsers = $this->getInactiveUsers($days, $limit);
        $sent = 0;
        $errors = [];
        
        foreach ($inactiveUsers as $user) {
            try {
                // Check if already sent recently
                $key = 'reactivation_email.' . $user->id;
                if (Cache::has($key)) {
                    continue;
                }
                
                $this->notificationService->sendReactivationEmail($user);
                $sent++;
                
                // Mark as sent
                Cache::put($key, true, 7 * 24 * 60); // 7 days
            } catch (\Exception $e) {
                $errors[] = [
                    'user_id' => $user->id,
                    'error' => $e->getMessage()
                ];
                
                Log::error('Failed to send reactivation email', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
        
        // Create audit log
        $this->auditService->log('reactivation_campaign', null, [
            'total_users' => $inactiveUsers->count(),
            'emails_sent' => $sent,
            'failed' => count($errors),
            'inactive_days' => $days,
        ]);
        
        return $sent;
    }
    
    /**
     * Archive user with full data backup
     */
    public function archiveUser(int $userId): bool
    {
        DB::beginTransaction();
        
        try {
            $user = $this->findUser($userId);
            
            if (!$user) {
                throw new \Exception('User not found');
            }
            
            // Export all user data
            $userData = $this->exportUserData($userId, 'json');
            
            // Archive user data
            $archived = $this->userRepository->archiveUser($user, $userData);
            
            if ($archived) {
                // Deactivate user
                $this->deactivateUser($userId, 'Archived');
                
                // Remove from search index
                $this->userRepository->removeFromSearchIndex($userId);
                
                // Create audit log
                $this->auditService->log('user_archived', $userId, [
                    'archive_id' => $archived->id,
                    'data_size' => strlen(json_encode($userData)),
                ]);
                
                // Log archival
                Log::info('User archived', [
                    'user_id' => $userId,
                    'archive_id' => $archived->id,
                ]);
            }
            
            DB::commit();
            return true;
        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }
    
    /**
     * Restore archived user
     */
    public function restoreArchivedUser(int $userId): bool
    {
        DB::beginTransaction();
        
        try {
            $archived = $this->userRepository->getArchivedUser($userId);
            
            if (!$archived) {
                throw new \Exception('Archived user not found');
            }
            
            // Restore user data
            $restored = $this->userRepository->restoreArchivedUser($userId);
            
            if ($restored) {
                // Import archived data
                $this->importUserData($archived->data);
                
                // Activate user
                $this->activateUser($userId);
                
                // Re-add to search index
                $this->userRepository->addToSearchIndex($userId);
                
                // Create audit log
                $this->auditService->log('user_restored', $userId, [
                    'archive_id' => $archived->id,
                ]);
                
                // Log restoration
                Log::info('User restored from archive', [
                    'user_id' => $userId,
                    'archive_id' => $archived->id,
                ]);
            }
            
            DB::commit();
            return true;
        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }
    
    /**
     * Get user preferences with defaults
     */
    public function getUserPreferences(int $userId): array
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        $defaults = config('user.default_preferences', [
            'email_notifications' => true,
            'push_notifications' => true,
            'sms_notifications' => false,
            'marketing_emails' => false,
            'weekly_digest' => true,
            'profile_visibility' => 'public',
            'show_online_status' => true,
            'allow_friend_requests' => true,
            'allow_messages' => true,
            'language' => 'en',
            'timezone' => 'UTC',
            'theme' => 'light',
            'date_format' => 'Y-m-d',
            'time_format' => 'H:i',
        ]);
        
        return array_merge($defaults, $user->preferences ?? []);
    }
    
    /**
     * Get user API tokens with usage stats
     */
    public function getUserApiTokens(int $userId)
    {
        return $this->userRepository->getApiTokens($userId)
            ->map(function ($token) {
                $token->usage_count = $this->userRepository->getApiTokenUsageCount($token->id);
                $token->last_used_at = $this->userRepository->getApiTokenLastUsed($token->id);
                return $token;
            });
    }
    
    /**
     * Create API token with abilities
     */
    public function createApiToken(int $userId, string $name, array $abilities = ['*'], $expiresAt = null): string
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Validate abilities
        $validAbilities = config('auth.api_abilities', ['read', 'write', 'delete']);
        foreach ($abilities as $ability) {
            if ($ability !== '*' && !in_array($ability, $validAbilities)) {
                throw new \Exception('Invalid ability: ' . $ability);
            }
        }
        
        // Generate token
        $token = $this->userRepository->createApiToken($user, $name, $abilities, $expiresAt);
        
        // Create audit log
        $this->auditService->log('api_token_created', $userId, [
            'token_name' => $name,
            'abilities' => $abilities,
            'expires_at' => $expiresAt,
        ]);
        
        // Log token creation
        Log::info('API token created', [
            'user_id' => $userId,
            'token_name' => $name,
        ]);
        
        return $token;
    }
    
    /**
     * Enable two-factor authentication with backup codes
     */
    public function enableTwoFactorAuth(int $userId): array
    {
        DB::beginTransaction();
        
        try {
            $user = $this->findUser($userId);
            
            if (!$user) {
                throw new \Exception('User not found');
            }
            
            if ($user->two_factor_enabled) {
                throw new \Exception('Two-factor authentication is already enabled');
            }
            
            // Generate secret
            $secret = $this->generateTwoFactorSecret();
            
            // Generate recovery codes
            $recoveryCodes = $this->generateRecoveryCodes(10);
            
            // Store secret (not enabled yet)
            $this->userRepository->update($user, [
                'two_factor_secret' => encrypt($secret),
                'two_factor_enabled' => false,
            ]);
            
            // Store recovery codes
            $this->userRepository->storeRecoveryCodes($userId, $recoveryCodes);
            
            // Generate QR code
            $qrCode = $this->generateTwoFactorQrCode($user->email, $secret);
            
            // Create audit log
            $this->auditService->log('two_factor_initiated', $userId);
            
            DB::commit();
            
            return [
                'secret' => $secret,
                'qr_code' => $qrCode,
                'recovery_codes' => $recoveryCodes,
            ];
        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }
    
    /**
     * Get user growth statistics with predictions
     */
    public function getUserGrowthStatistics(string $period = 'month'): array
    {
        $stats = [];
        $historicalData = [];
        
        switch ($period) {
            case 'day':
                for ($i = 23; $i >= 0; $i--) {
                    $hour = now()->subHours($i);
                    $count = $this->userRepository->getCreatedBetween(
                        $hour->startOfHour(),
                        $hour->endOfHour()
                    )->count();
                    
                    $stats[$hour->format('H:00')] = $count;
                    $historicalData[] = $count;
                }
                break;
                
            case 'week':
                for ($i = 6; $i >= 0; $i--) {
                    $day = now()->subDays($i);
                    $count = $this->userRepository->getCreatedBetween(
                        $day->startOfDay(),
                        $day->endOfDay()
                    )->count();
                    
                    $stats[$day->format('D')] = $count;
                    $historicalData[] = $count;
                }
                break;
                
            case 'month':
                for ($i = 29; $i >= 0; $i--) {
                    $day = now()->subDays($i);
                    $count = $this->userRepository->getCreatedBetween(
                        $day->startOfDay(),
                        $day->endOfDay()
                    )->count();
                    
                    $stats[$day->format('m/d')] = $count;
                    $historicalData[] = $count;
                }
                break;
                
            case 'year':
                for ($i = 11; $i >= 0; $i--) {
                    $month = now()->subMonths($i);
                    $count = $this->userRepository->getCreatedBetween(
                        $month->startOfMonth(),
                        $month->endOfMonth()
                    )->count();
                    
                    $stats[$month->format('M')] = $count;
                    $historicalData[] = $count;
                }
                break;
        }
        
        // Calculate trend and predictions
        $trend = $this->calculateTrend($historicalData);
        $predictions = $this->predictGrowth($historicalData, 5);
        
        return [
            'data' => $stats,
            'summary' => [
                'total' => array_sum($historicalData),
                'average' => round(array_sum($historicalData) / count($historicalData), 2),
                'peak' => max($historicalData),
                'lowest' => min($historicalData),
            ],
            'trend' => $trend,
            'predictions' => $predictions,
        ];
    }
    
    /**
     * Calculate growth trend
     */
    protected function calculateTrend(array $data): array
    {
        $n = count($data);
        if ($n < 2) {
            return ['direction' => 'stable', 'strength' => 0];
        }
        
        // Simple linear regression
        $sumX = 0;
        $sumY = 0;
        $sumXY = 0;
        $sumX2 = 0;
        
        for ($i = 0; $i < $n; $i++) {
            $sumX += $i;
            $sumY += $data[$i];
            $sumXY += $i * $data[$i];
            $sumX2 += $i * $i;
        }
        
        $slope = ($n * $sumXY - $sumX * $sumY) / ($n * $sumX2 - $sumX * $sumX);
        
        return [
            'direction' => $slope > 0.1 ? 'growing' : ($slope < -0.1 ? 'declining' : 'stable'),
            'strength' => abs($slope),
            'percentage' => round($slope * 100, 2),
        ];
    }
    
    /**
     * Predict future growth
     */
    protected function predictGrowth(array $historicalData, int $periods): array
    {
        // Simple moving average prediction
        $recentPeriods = array_slice($historicalData, -7);
        $average = array_sum($recentPeriods) / count($recentPeriods);
        
        $predictions = [];
        for ($i = 1; $i <= $periods; $i++) {
            $predictions[] = round($average * (1 + (0.05 * rand(-1, 1)))); // Add some variance
        }
        
        return $predictions;
    }
    
    /**
     * Get comprehensive user engagement metrics
     */
    public function getUserEngagementMetrics(string $period = 'month'): array
    {
        $startDate = match($period) {
            'day' => now()->subDay(),
            'week' => now()->subWeek(),
            'month' => now()->subMonth(),
            'year' => now()->subYear(),
            default => now()->subMonth(),
        };
        
        $totalUsers = $this->userRepository->count();
        $activeUsers = $this->userRepository->getActiveSince($startDate)->count();
        $newUsers = $this->userRepository->getCreatedBetween($startDate, now())->count();
        $returningUsers = $activeUsers - $newUsers;
        
        // Calculate detailed metrics
        $metrics = [
            'overview' => [
                'total_users' => $totalUsers,
                'active_users' => $activeUsers,
                'new_users' => $newUsers,
                'returning_users' => $returningUsers,
            ],
            'rates' => [
                'engagement_rate' => $totalUsers > 0 ? round(($activeUsers / $totalUsers) * 100, 2) : 0,
                'growth_rate' => $totalUsers > 0 ? round(($newUsers / $totalUsers) * 100, 2) : 0,
                'retention_rate' => $activeUsers > 0 ? round(($returningUsers / $activeUsers) * 100, 2) : 0,
                'churn_rate' => $this->calculateChurnRate($startDate),
            ],
            'activity' => [
                'average_session_duration' => $this->userRepository->getAverageSessionDuration($startDate),
                'average_sessions_per_user' => $this->userRepository->getAverageSessionsPerUser($startDate),
                'average_page_views' => $this->userRepository->getAveragePageViews($startDate),
            ],
            'content' => [
                'posts_created' => $this->userRepository->getPostsCreatedSince($startDate),
                'comments_created' => $this->userRepository->getCommentsCreatedSince($startDate),
                'likes_given' => $this->userRepository->getLikesGivenSince($startDate),
                'average_posts_per_user' => $this->userRepository->getAveragePostsPerUser($startDate),
                'average_comments_per_user' => $this->userRepository->getAverageCommentsPerUser($startDate),
            ],
            'social' => [
                'friend_connections' => $this->userRepository->getFriendConnectionsSince($startDate),
                'follow_actions' => $this->userRepository->getFollowActionsSince($startDate),
                'messages_sent' => $this->userRepository->getMessagesSentSince($startDate),
            ],
            'top_performers' => [
                'most_active' => $this->getMostActiveUsers($startDate, 10),
                'most_followed' => $this->getMostFollowedUsers($startDate, 10),
                'most_engaging' => $this->getMostEngagingUsers($startDate, 10),
            ],
        ];
        
        return $metrics;
    }
    
    /**
     * Calculate churn rate
     */
    protected function calculateChurnRate($startDate): float
    {
        $previousPeriodStart = $startDate->copy()->sub($startDate->diff(now()));
        
        $previousActiveUsers = $this->userRepository->getActiveBetween(
            $previousPeriodStart,
            $startDate
        )->count();
        
        $stillActiveUsers = $this->userRepository->getActiveBetween(
            $previousPeriodStart,
            $startDate
        )->filter(function ($user) use ($startDate) {
            return $this->userRepository->hasActivitySince($user->id, $startDate);
        })->count();
        
        if ($previousActiveUsers == 0) {
            return 0.0;
        }
        
        $churnedUsers = $previousActiveUsers - $stillActiveUsers;
        
        return round(($churnedUsers / $previousActiveUsers) * 100, 2);
    }
    
    /**
     * Get most active users
     */
    protected function getMostActiveUsers($since, int $limit): array
    {
        return $this->userRepository->getMostActiveSince($since, $limit)
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'activity_score' => $user->activity_score,
                    'posts_count' => $user->posts_count,
                    'comments_count' => $user->comments_count,
                ];
            })
            ->toArray();
    }
    
    /**
     * Get most followed users
     */
    protected function getMostFollowedUsers($since, int $limit): array
    {
        return $this->userRepository->getMostFollowedSince($since, $limit)
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'followers_count' => $user->followers_count,
                    'new_followers' => $user->new_followers_count,
                ];
            })
            ->toArray();
    }
    
    /**
     * Get most engaging users
     */
    protected function getMostEngagingUsers($since, int $limit): array
    {
        return $this->userRepository->getMostEngagingSince($since, $limit)
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'engagement_score' => $user->engagement_score,
                    'total_engagements' => $user->total_engagements,
                ];
            })
            ->toArray();
    }
}