<?php

/**
 * Large file test - User management system
 * This file contains thousands of lines to test performance
 */

namespace App\Services;

use App\Models\User;
use App\Events\UserCreated;
use App\Events\UserUpdated;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class UserService
{
    protected $userRepository;
    protected $notificationService;
    protected $validationService;
    
    public function __construct(
        UserRepository $userRepository,
        NotificationService $notificationService,
        ValidationService $validationService
    ) {
        $this->userRepository = $userRepository;
        $this->notificationService = $notificationService;
        $this->validationService = $validationService;
    }
    
    /**
     * Create a new user
     */
    public function createUser(array $data): User
    {
        // Validate the input data
        $validated = $this->validationService->validateUserData($data);
        
        // Check if email already exists
        if ($this->userRepository->emailExists($validated['email'])) {
            throw new \Exception('Email already exists');
        }
        
        // Hash the password
        $validated['password'] = Hash::make($validated['password']);
        
        // Create the user
        $user = $this->userRepository->create($validated);
        
        // Fire event
        event(new UserCreated($user));
        
        // Send welcome email
        $this->notificationService->sendWelcomeEmail($user);
        
        // Log the creation
        Log::info('User created', ['user_id' => $user->id]);
        
        return $user;
    }
    
    /**
     * Update an existing user
     */
    public function updateUser(int $userId, array $data): User
    {
        // Find the user
        $user = $this->userRepository->findOrFail($userId);
        
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
        }
        
        // Update the user
        $user = $this->userRepository->update($user, $validated);
        
        // Fire event
        event(new UserUpdated($user));
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        // Log the update
        Log::info('User updated', ['user_id' => $user->id]);
        
        return $user;
    }
    
    /**
     * Delete a user
     */
    public function deleteUser(int $userId): bool
    {
        // Find the user
        $user = $this->userRepository->findOrFail($userId);
        
        // Check if user can be deleted
        if (!$this->canDeleteUser($user)) {
            throw new \Exception('User cannot be deleted');
        }
        
        // Delete the user
        $result = $this->userRepository->delete($user);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        // Log the deletion
        Log::info('User deleted', ['user_id' => $userId]);
        
        return $result;
    }
    
    /**
     * Find a user by ID
     */
    public function findUser(int $userId): ?User
    {
        return Cache::remember('user.' . $userId, 3600, function () use ($userId) {
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
     * Get all users with pagination
     */
    public function getAllUsers(int $perPage = 15, array $filters = [])
    {
        return $this->userRepository->paginate($perPage, $filters);
    }
    
    /**
     * Search users
     */
    public function searchUsers(string $query, int $limit = 10)
    {
        return $this->userRepository->search($query, $limit);
    }
    
    /**
     * Get user statistics
     */
    public function getUserStatistics(int $userId): array
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        return [
            'total_posts' => $user->posts()->count(),
            'total_comments' => $user->comments()->count(),
            'total_likes' => $user->likes()->count(),
            'account_age_days' => $user->created_at->diffInDays(now()),
            'last_login' => $user->last_login_at,
            'profile_completion' => $this->calculateProfileCompletion($user),
        ];
    }
    
    /**
     * Calculate profile completion percentage
     */
    protected function calculateProfileCompletion(User $user): int
    {
        $completion = 0;
        $fields = ['first_name', 'last_name', 'bio', 'avatar', 'phone', 'address'];
        $totalFields = count($fields);
        
        foreach ($fields as $field) {
            if (!empty($user->$field)) {
                $completion++;
            }
        }
        
        return (int) (($completion / $totalFields) * 100);
    }
    
    /**
     * Check if user can be deleted
     */
    protected function canDeleteUser(User $user): bool
    {
        // Admin users cannot be deleted
        if ($user->isAdmin()) {
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
        
        return true;
    }
    
    /**
     * Authenticate user
     */
    public function authenticate(string $email, string $password): ?User
    {
        $user = $this->findUserByEmail($email);
        
        if (!$user) {
            return null;
        }
        
        if (!Hash::check($password, $user->password)) {
            return null;
        }
        
        // Update last login
        $this->userRepository->updateLastLogin($user);
        
        return $user;
    }
    
    /**
     * Reset user password
     */
    public function resetPassword(int $userId, string $newPassword): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Update password
        $result = $this->userRepository->update($user, [
            'password' => Hash::make($newPassword),
            'password_reset_at' => now(),
        ]);
        
        // Send notification
        $this->notificationService->sendPasswordResetNotification($user);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        return $result !== false;
    }
    
    /**
     * Activate user account
     */
    public function activateUser(int $userId): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        if ($user->is_active) {
            return true;
        }
        
        // Activate the user
        $result = $this->userRepository->update($user, [
            'is_active' => true,
            'activated_at' => now(),
        ]);
        
        // Send notification
        $this->notificationService->sendActivationNotification($user);
        
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
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        return $result !== false;
    }
    
    /**
     * Get user activity log
     */
    public function getUserActivityLog(int $userId, int $limit = 50)
    {
        return $this->userRepository->getActivityLog($userId, $limit);
    }
    
    /**
     * Update user preferences
     */
    public function updateUserPreferences(int $userId, array $preferences): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Update preferences
        $result = $this->userRepository->updatePreferences($user, $preferences);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        return $result;
    }
    
    /**
     * Get user notifications
     */
    public function getUserNotifications(int $userId, bool $unreadOnly = false)
    {
        return $this->userRepository->getNotifications($userId, $unreadOnly);
    }
    
    /**
     * Mark notification as read
     */
    public function markNotificationAsRead(int $userId, int $notificationId): bool
    {
        return $this->userRepository->markNotificationAsRead($userId, $notificationId);
    }
    
    /**
     * Get user's friends
     */
    public function getUserFriends(int $userId, int $limit = 20)
    {
        return $this->userRepository->getFriends($userId, $limit);
    }
    
    /**
     * Send friend request
     */
    public function sendFriendRequest(int $fromUserId, int $toUserId): bool
    {
        // Check if users exist
        $fromUser = $this->findUser($fromUserId);
        $toUser = $this->findUser($toUserId);
        
        if (!$fromUser || !$toUser) {
            throw new \Exception('User not found');
        }
        
        // Check if already friends
        if ($this->userRepository->areFriends($fromUserId, $toUserId)) {
            throw new \Exception('Users are already friends');
        }
        
        // Send request
        $result = $this->userRepository->createFriendRequest($fromUserId, $toUserId);
        
        // Send notification
        $this->notificationService->sendFriendRequestNotification($fromUser, $toUser);
        
        return $result;
    }
    
    /**
     * Accept friend request
     */
    public function acceptFriendRequest(int $userId, int $requestId): bool
    {
        $result = $this->userRepository->acceptFriendRequest($userId, $requestId);
        
        if ($result) {
            // Send notification
            $request = $this->userRepository->getFriendRequest($requestId);
            $this->notificationService->sendFriendRequestAcceptedNotification(
                $request->fromUser,
                $request->toUser
            );
        }
        
        return $result;
    }
    
    /**
     * Reject friend request
     */
    public function rejectFriendRequest(int $userId, int $requestId): bool
    {
        return $this->userRepository->rejectFriendRequest($userId, $requestId);
    }
    
    /**
     * Remove friend
     */
    public function removeFriend(int $userId, int $friendId): bool
    {
        return $this->userRepository->removeFriend($userId, $friendId);
    }
    
    /**
     * Block user
     */
    public function blockUser(int $userId, int $blockedUserId): bool
    {
        // Check if users exist
        $user = $this->findUser($userId);
        $blockedUser = $this->findUser($blockedUserId);
        
        if (!$user || !$blockedUser) {
            throw new \Exception('User not found');
        }
        
        // Block user
        $result = $this->userRepository->blockUser($userId, $blockedUserId);
        
        // Remove from friends if they were friends
        if ($this->userRepository->areFriends($userId, $blockedUserId)) {
            $this->userRepository->removeFriend($userId, $blockedUserId);
        }
        
        return $result;
    }
    
    /**
     * Unblock user
     */
    public function unblockUser(int $userId, int $blockedUserId): bool
    {
        return $this->userRepository->unblockUser($userId, $blockedUserId);
    }
    
    /**
     * Get blocked users
     */
    public function getBlockedUsers(int $userId)
    {
        return $this->userRepository->getBlockedUsers($userId);
    }
    
    /**
     * Update user avatar
     */
    public function updateUserAvatar(int $userId, $avatarFile): string
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Process and store avatar
        $avatarPath = $this->processAvatar($avatarFile);
        
        // Update user
        $this->userRepository->update($user, ['avatar' => $avatarPath]);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        return $avatarPath;
    }
    
    /**
     * Process avatar file
     */
    protected function processAvatar($file): string
    {
        // Validate file
        if (!$file->isValid()) {
            throw new \Exception('Invalid file');
        }
        
        // Check file type
        $allowedTypes = ['jpg', 'jpeg', 'png', 'gif'];
        if (!in_array($file->getClientOriginalExtension(), $allowedTypes)) {
            throw new \Exception('Invalid file type');
        }
        
        // Check file size (max 5MB)
        if ($file->getSize() > 5 * 1024 * 1024) {
            throw new \Exception('File too large');
        }
        
        // Generate unique filename
        $filename = uniqid() . '.' . $file->getClientOriginalExtension();
        
        // Store file
        $path = $file->storeAs('avatars', $filename, 'public');
        
        return $path;
    }
    
    /**
     * Get user's posts
     */
    public function getUserPosts(int $userId, int $limit = 10)
    {
        return $this->userRepository->getPosts($userId, $limit);
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
     * Get user's followers
     */
    public function getUserFollowers(int $userId, int $limit = 20)
    {
        return $this->userRepository->getFollowers($userId, $limit);
    }
    
    /**
     * Get users that user is following
     */
    public function getUserFollowing(int $userId, int $limit = 20)
    {
        return $this->userRepository->getFollowing($userId, $limit);
    }
    
    /**
     * Follow user
     */
    public function followUser(int $userId, int $targetUserId): bool
    {
        // Check if users exist
        $user = $this->findUser($userId);
        $targetUser = $this->findUser($targetUserId);
        
        if (!$user || !$targetUser) {
            throw new \Exception('User not found');
        }
        
        // Check if already following
        if ($this->userRepository->isFollowing($userId, $targetUserId)) {
            return true;
        }
        
        // Follow user
        $result = $this->userRepository->followUser($userId, $targetUserId);
        
        // Send notification
        $this->notificationService->sendFollowNotification($user, $targetUser);
        
        return $result;
    }
    
    /**
     * Unfollow user
     */
    public function unfollowUser(int $userId, int $targetUserId): bool
    {
        return $this->userRepository->unfollowUser($userId, $targetUserId);
    }
    
    /**
     * Get user's subscription
     */
    public function getUserSubscription(int $userId)
    {
        return $this->userRepository->getActiveSubscription($userId);
    }
    
    /**
     * Subscribe user to plan
     */
    public function subscribeUser(int $userId, string $planId, array $paymentDetails): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Process payment
        $paymentResult = $this->processPayment($paymentDetails);
        
        if (!$paymentResult['success']) {
            throw new \Exception('Payment failed: ' . $paymentResult['message']);
        }
        
        // Create subscription
        $subscription = $this->userRepository->createSubscription($userId, $planId, $paymentResult['transaction_id']);
        
        // Send notification
        $this->notificationService->sendSubscriptionNotification($user, $subscription);
        
        return true;
    }
    
    /**
     * Cancel user subscription
     */
    public function cancelSubscription(int $userId): bool
    {
        $subscription = $this->getUserSubscription($userId);
        
        if (!$subscription) {
            throw new \Exception('No active subscription found');
        }
        
        // Cancel subscription
        $result = $this->userRepository->cancelSubscription($subscription->id);
        
        // Send notification
        $user = $this->findUser($userId);
        $this->notificationService->sendSubscriptionCancellationNotification($user, $subscription);
        
        return $result;
    }
    
    /**
     * Process payment (mock implementation)
     */
    protected function processPayment(array $paymentDetails): array
    {
        // This would integrate with a real payment gateway
        // For now, just return success
        return [
            'success' => true,
            'transaction_id' => uniqid('txn_'),
            'message' => 'Payment processed successfully',
        ];
    }
    
    /**
     * Export user data
     */
    public function exportUserData(int $userId): array
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        return [
            'profile' => $user->toArray(),
            'posts' => $this->getUserPosts($userId, 1000)->toArray(),
            'comments' => $this->getUserComments($userId, 1000)->toArray(),
            'likes' => $this->getUserLikes($userId, 1000)->toArray(),
            'friends' => $this->getUserFriends($userId, 1000)->toArray(),
            'followers' => $this->getUserFollowers($userId, 1000)->toArray(),
            'following' => $this->getUserFollowing($userId, 1000)->toArray(),
            'notifications' => $this->getUserNotifications($userId)->toArray(),
            'activity_log' => $this->getUserActivityLog($userId, 1000)->toArray(),
        ];
    }
    
    /**
     * Import user data
     */
    public function importUserData(array $data): User
    {
        // Validate data structure
        if (!isset($data['profile']) || !isset($data['profile']['email'])) {
            throw new \Exception('Invalid data format');
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
        
        // ... import other data
        
        return $user;
    }
    
    /**
     * Import user posts
     */
    protected function importUserPosts(int $userId, array $posts): void
    {
        foreach ($posts as $postData) {
            $this->userRepository->createPost($userId, $postData);
        }
    }
    
    /**
     * Import user comments
     */
    protected function importUserComments(int $userId, array $comments): void
    {
        foreach ($comments as $commentData) {
            $this->userRepository->createComment($userId, $commentData);
        }
    }
    
    /**
     * Merge duplicate users
     */
    public function mergeUsers(int $primaryUserId, int $secondaryUserId): bool
    {
        $primaryUser = $this->findUser($primaryUserId);
        $secondaryUser = $this->findUser($secondaryUserId);
        
        if (!$primaryUser || !$secondaryUser) {
            throw new \Exception('User not found');
        }
        
        // Transfer all data from secondary to primary
        $this->userRepository->transferPosts($secondaryUserId, $primaryUserId);
        $this->userRepository->transferComments($secondaryUserId, $primaryUserId);
        $this->userRepository->transferLikes($secondaryUserId, $primaryUserId);
        $this->userRepository->transferFriends($secondaryUserId, $primaryUserId);
        $this->userRepository->transferFollowers($secondaryUserId, $primaryUserId);
        
        // Delete secondary user
        $this->deleteUser($secondaryUserId);
        
        // Clear cache
        Cache::forget('user.' . $primaryUserId);
        
        return true;
    }
    
    /**
     * Verify user email
     */
    public function verifyEmail(int $userId, string $token): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Verify token
        if (!$this->userRepository->verifyEmailToken($userId, $token)) {
            throw new \Exception('Invalid verification token');
        }
        
        // Mark email as verified
        $result = $this->userRepository->update($user, [
            'email_verified_at' => now(),
        ]);
        
        // Send notification
        $this->notificationService->sendEmailVerifiedNotification($user);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
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
        
        // Generate token
        $token = $this->userRepository->generateEmailVerificationToken($userId);
        
        // Send email
        $this->notificationService->sendVerificationEmail($user, $token);
        
        return true;
    }
    
    /**
     * Update user role
     */
    public function updateUserRole(int $userId, string $role): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Validate role
        $validRoles = ['user', 'moderator', 'admin'];
        if (!in_array($role, $validRoles)) {
            throw new \Exception('Invalid role');
        }
        
        // Update role
        $result = $this->userRepository->update($user, ['role' => $role]);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        // Log role change
        Log::info('User role updated', [
            'user_id' => $userId,
            'old_role' => $user->role,
            'new_role' => $role,
        ]);
        
        return $result !== false;
    }
    
    /**
     * Get users by role
     */
    public function getUsersByRole(string $role, int $limit = 100)
    {
        return $this->userRepository->getByRole($role, $limit);
    }
    
    /**
     * Ban user
     */
    public function banUser(int $userId, string $reason, $duration = null): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Calculate ban expiry
        $bannedUntil = $duration ? now()->addDays($duration) : null;
        
        // Ban user
        $result = $this->userRepository->update($user, [
            'is_banned' => true,
            'ban_reason' => $reason,
            'banned_at' => now(),
            'banned_until' => $bannedUntil,
        ]);
        
        // Send notification
        $this->notificationService->sendBanNotification($user, $reason, $bannedUntil);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        // Log ban
        Log::warning('User banned', [
            'user_id' => $userId,
            'reason' => $reason,
            'duration' => $duration,
        ]);
        
        return $result !== false;
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
        ]);
        
        // Send notification
        $this->notificationService->sendUnbanNotification($user);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        // Log unban
        Log::info('User unbanned', ['user_id' => $userId]);
        
        return $result !== false;
    }
    
    /**
     * Get banned users
     */
    public function getBannedUsers(int $limit = 100)
    {
        return $this->userRepository->getBannedUsers($limit);
    }
    
    /**
     * Check if user is online
     */
    public function isUserOnline(int $userId): bool
    {
        return Cache::has('user.online.' . $userId);
    }
    
    /**
     * Update user online status
     */
    public function updateOnlineStatus(int $userId, bool $online = true): void
    {
        if ($online) {
            Cache::put('user.online.' . $userId, true, 300); // 5 minutes
        } else {
            Cache::forget('user.online.' . $userId);
        }
    }
    
    /**
     * Get online users
     */
    public function getOnlineUsers(int $limit = 100)
    {
        $onlineUserIds = [];
        
        // Get all cached online user keys
        // This is a simplified approach - in production, use Redis or similar
        $users = $this->userRepository->getAll();
        
        foreach ($users as $user) {
            if ($this->isUserOnline($user->id)) {
                $onlineUserIds[] = $user->id;
                
                if (count($onlineUserIds) >= $limit) {
                    break;
                }
            }
        }
        
        return $this->userRepository->getByIds($onlineUserIds);
    }
    
    /**
     * Generate user report
     */
    public function generateUserReport(int $userId, string $type = 'full'): array
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        $report = [
            'user' => $user->toArray(),
            'generated_at' => now()->toDateTimeString(),
            'type' => $type,
        ];
        
        switch ($type) {
            case 'activity':
                $report['activity'] = [
                    'posts' => $user->posts()->count(),
                    'comments' => $user->comments()->count(),
                    'likes' => $user->likes()->count(),
                    'last_activity' => $this->userRepository->getLastActivity($userId),
                ];
                break;
                
            case 'social':
                $report['social'] = [
                    'friends' => $user->friends()->count(),
                    'followers' => $user->followers()->count(),
                    'following' => $user->following()->count(),
                    'blocked' => $this->getBlockedUsers($userId)->count(),
                ];
                break;
                
            case 'full':
            default:
                $report['statistics'] = $this->getUserStatistics($userId);
                $report['activity'] = [
                    'posts' => $user->posts()->count(),
                    'comments' => $user->comments()->count(),
                    'likes' => $user->likes()->count(),
                    'last_activity' => $this->userRepository->getLastActivity($userId),
                ];
                $report['social'] = [
                    'friends' => $user->friends()->count(),
                    'followers' => $user->followers()->count(),
                    'following' => $user->following()->count(),
                    'blocked' => $this->getBlockedUsers($userId)->count(),
                ];
                $report['subscription'] = $this->getUserSubscription($userId);
                break;
        }
        
        return $report;
    }
    
    /**
     * Bulk update users
     */
    public function bulkUpdateUsers(array $userIds, array $data): int
    {
        $updated = 0;
        
        foreach ($userIds as $userId) {
            try {
                $this->updateUser($userId, $data);
                $updated++;
            } catch (\Exception $e) {
                Log::error('Failed to update user in bulk operation', [
                    'user_id' => $userId,
                    'error' => $e->getMessage(),
                ]);
            }
        }
        
        return $updated;
    }
    
    /**
     * Bulk delete users
     */
    public function bulkDeleteUsers(array $userIds): int
    {
        $deleted = 0;
        
        foreach ($userIds as $userId) {
            try {
                $this->deleteUser($userId);
                $deleted++;
            } catch (\Exception $e) {
                Log::error('Failed to delete user in bulk operation', [
                    'user_id' => $userId,
                    'error' => $e->getMessage(),
                ]);
            }
        }
        
        return $deleted;
    }
    
    /**
     * Get users created between dates
     */
    public function getUsersCreatedBetween($startDate, $endDate)
    {
        return $this->userRepository->getCreatedBetween($startDate, $endDate);
    }
    
    /**
     * Get inactive users
     */
    public function getInactiveUsers(int $days = 30, int $limit = 100)
    {
        $date = now()->subDays($days);
        return $this->userRepository->getInactiveSince($date, $limit);
    }
    
    /**
     * Send reactivation emails to inactive users
     */
    public function sendReactivationEmails(int $days = 30): int
    {
        $inactiveUsers = $this->getInactiveUsers($days, 1000);
        $sent = 0;
        
        foreach ($inactiveUsers as $user) {
            try {
                $this->notificationService->sendReactivationEmail($user);
                $sent++;
            } catch (\Exception $e) {
                Log::error('Failed to send reactivation email', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
        
        return $sent;
    }
    
    /**
     * Archive user
     */
    public function archiveUser(int $userId): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Archive user data
        $archived = $this->userRepository->archiveUser($user);
        
        if ($archived) {
            // Deactivate user
            $this->deactivateUser($userId, 'Archived');
            
            // Log archival
            Log::info('User archived', ['user_id' => $userId]);
        }
        
        return $archived;
    }
    
    /**
     * Restore archived user
     */
    public function restoreArchivedUser(int $userId): bool
    {
        $restored = $this->userRepository->restoreArchivedUser($userId);
        
        if ($restored) {
            // Activate user
            $this->activateUser($userId);
            
            // Log restoration
            Log::info('User restored from archive', ['user_id' => $userId]);
        }
        
        return $restored;
    }
    
    /**
     * Get user preferences
     */
    public function getUserPreferences(int $userId): array
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        return $user->preferences ?? [
            'email_notifications' => true,
            'push_notifications' => true,
            'marketing_emails' => false,
            'profile_visibility' => 'public',
            'show_online_status' => true,
            'language' => 'en',
            'timezone' => 'UTC',
            'theme' => 'light',
        ];
    }
    
    /**
     * Update user language
     */
    public function updateUserLanguage(int $userId, string $language): bool
    {
        $preferences = $this->getUserPreferences($userId);
        $preferences['language'] = $language;
        
        return $this->updateUserPreferences($userId, $preferences);
    }
    
    /**
     * Update user timezone
     */
    public function updateUserTimezone(int $userId, string $timezone): bool
    {
        $preferences = $this->getUserPreferences($userId);
        $preferences['timezone'] = $timezone;
        
        return $this->updateUserPreferences($userId, $preferences);
    }
    
    /**
     * Get user's API tokens
     */
    public function getUserApiTokens(int $userId)
    {
        return $this->userRepository->getApiTokens($userId);
    }
    
    /**
     * Create API token for user
     */
    public function createApiToken(int $userId, string $name, array $abilities = ['*']): string
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Generate token
        $token = $this->userRepository->createApiToken($user, $name, $abilities);
        
        // Log token creation
        Log::info('API token created', [
            'user_id' => $userId,
            'token_name' => $name,
        ]);
        
        return $token;
    }
    
    /**
     * Revoke API token
     */
    public function revokeApiToken(int $userId, int $tokenId): bool
    {
        $result = $this->userRepository->revokeApiToken($userId, $tokenId);
        
        if ($result) {
            // Log token revocation
            Log::info('API token revoked', [
                'user_id' => $userId,
                'token_id' => $tokenId,
            ]);
        }
        
        return $result;
    }
    
    /**
     * Get user's sessions
     */
    public function getUserSessions(int $userId)
    {
        return $this->userRepository->getSessions($userId);
    }
    
    /**
     * Terminate user session
     */
    public function terminateSession(int $userId, string $sessionId): bool
    {
        return $this->userRepository->terminateSession($userId, $sessionId);
    }
    
    /**
     * Terminate all user sessions
     */
    public function terminateAllSessions(int $userId): bool
    {
        return $this->userRepository->terminateAllSessions($userId);
    }
    
    /**
     * Get user's devices
     */
    public function getUserDevices(int $userId)
    {
        return $this->userRepository->getDevices($userId);
    }
    
    /**
     * Register user device
     */
    public function registerDevice(int $userId, array $deviceInfo): bool
    {
        return $this->userRepository->registerDevice($userId, $deviceInfo);
    }
    
    /**
     * Remove user device
     */
    public function removeDevice(int $userId, string $deviceId): bool
    {
        return $this->userRepository->removeDevice($userId, $deviceId);
    }
    
    /**
     * Get user's login history
     */
    public function getLoginHistory(int $userId, int $limit = 50)
    {
        return $this->userRepository->getLoginHistory($userId, $limit);
    }
    
    /**
     * Record login attempt
     */
    public function recordLoginAttempt(string $email, bool $successful, string $ipAddress): void
    {
        $this->userRepository->recordLoginAttempt($email, $successful, $ipAddress);
    }
    
    /**
     * Get failed login attempts
     */
    public function getFailedLoginAttempts(string $email, int $minutes = 15): int
    {
        return $this->userRepository->getFailedLoginAttempts($email, $minutes);
    }
    
    /**
     * Lock user account
     */
    public function lockAccount(int $userId, int $minutes = 30): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Lock account
        $result = $this->userRepository->update($user, [
            'locked_until' => now()->addMinutes($minutes),
        ]);
        
        // Send notification
        $this->notificationService->sendAccountLockedNotification($user, $minutes);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        // Log account lock
        Log::warning('User account locked', [
            'user_id' => $userId,
            'locked_for_minutes' => $minutes,
        ]);
        
        return $result !== false;
    }
    
    /**
     * Unlock user account
     */
    public function unlockAccount(int $userId): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Unlock account
        $result = $this->userRepository->update($user, [
            'locked_until' => null,
        ]);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        // Log account unlock
        Log::info('User account unlocked', ['user_id' => $userId]);
        
        return $result !== false;
    }
    
    /**
     * Check if account is locked
     */
    public function isAccountLocked(int $userId): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            return false;
        }
        
        return $user->locked_until && $user->locked_until->isFuture();
    }
    
    /**
     * Enable two-factor authentication
     */
    public function enableTwoFactorAuth(int $userId): array
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Generate secret
        $secret = $this->generateTwoFactorSecret();
        
        // Store secret
        $this->userRepository->update($user, [
            'two_factor_secret' => encrypt($secret),
            'two_factor_enabled' => false, // Will be enabled after verification
        ]);
        
        // Generate QR code
        $qrCode = $this->generateTwoFactorQrCode($user->email, $secret);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        return [
            'secret' => $secret,
            'qr_code' => $qrCode,
        ];
    }
    
    /**
     * Verify and complete two-factor setup
     */
    public function verifyTwoFactorSetup(int $userId, string $code): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        if (!$user->two_factor_secret) {
            throw new \Exception('Two-factor authentication not initialized');
        }
        
        // Verify code
        if (!$this->verifyTwoFactorCode($user->two_factor_secret, $code)) {
            return false;
        }
        
        // Enable two-factor
        $this->userRepository->update($user, [
            'two_factor_enabled' => true,
            'two_factor_verified_at' => now(),
        ]);
        
        // Generate recovery codes
        $recoveryCodes = $this->generateRecoveryCodes();
        $this->userRepository->storeRecoveryCodes($userId, $recoveryCodes);
        
        // Send notification
        $this->notificationService->sendTwoFactorEnabledNotification($user);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        return true;
    }
    
    /**
     * Disable two-factor authentication
     */
    public function disableTwoFactorAuth(int $userId): bool
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        // Disable two-factor
        $result = $this->userRepository->update($user, [
            'two_factor_enabled' => false,
            'two_factor_secret' => null,
            'two_factor_verified_at' => null,
        ]);
        
        // Remove recovery codes
        $this->userRepository->removeRecoveryCodes($userId);
        
        // Send notification
        $this->notificationService->sendTwoFactorDisabledNotification($user);
        
        // Clear cache
        Cache::forget('user.' . $userId);
        
        return $result !== false;
    }
    
    /**
     * Generate two-factor secret
     */
    protected function generateTwoFactorSecret(): string
    {
        return \Google2FA::generateSecretKey();
    }
    
    /**
     * Generate two-factor QR code
     */
    protected function generateTwoFactorQrCode(string $email, string $secret): string
    {
        $companyName = config('app.name');
        $qrCodeUrl = \Google2FA::getQRCodeUrl(
            $companyName,
            $email,
            $secret
        );
        
        return $qrCodeUrl;
    }
    
    /**
     * Verify two-factor code
     */
    protected function verifyTwoFactorCode(string $secret, string $code): bool
    {
        return \Google2FA::verifyKey(decrypt($secret), $code);
    }
    
    /**
     * Generate recovery codes
     */
    protected function generateRecoveryCodes(int $count = 8): array
    {
        $codes = [];
        
        for ($i = 0; $i < $count; $i++) {
            $codes[] = strtoupper(bin2hex(random_bytes(4))) . '-' . strtoupper(bin2hex(random_bytes(4)));
        }
        
        return $codes;
    }
    
    /**
     * Verify recovery code
     */
    public function verifyRecoveryCode(int $userId, string $code): bool
    {
        return $this->userRepository->verifyAndUseRecoveryCode($userId, $code);
    }
    
    /**
     * Get user's security settings
     */
    public function getSecuritySettings(int $userId): array
    {
        $user = $this->findUser($userId);
        
        if (!$user) {
            throw new \Exception('User not found');
        }
        
        return [
            'two_factor_enabled' => $user->two_factor_enabled,
            'two_factor_verified_at' => $user->two_factor_verified_at,
            'password_updated_at' => $user->password_updated_at,
            'sessions_count' => $this->getUserSessions($userId)->count(),
            'api_tokens_count' => $this->getUserApiTokens($userId)->count(),
            'failed_login_attempts' => $this->getFailedLoginAttempts($user->email),
            'account_locked' => $this->isAccountLocked($userId),
        ];
    }
    
    /**
     * Get user growth statistics
     */
    public function getUserGrowthStatistics(string $period = 'month'): array
    {
        $stats = [];
        
        switch ($period) {
            case 'day':
                for ($i = 23; $i >= 0; $i--) {
                    $hour = now()->subHours($i);
                    $stats[$hour->format('H:00')] = $this->userRepository->getCreatedBetween(
                        $hour->startOfHour(),
                        $hour->endOfHour()
                    )->count();
                }
                break;
                
            case 'week':
                for ($i = 6; $i >= 0; $i--) {
                    $day = now()->subDays($i);
                    $stats[$day->format('D')] = $this->userRepository->getCreatedBetween(
                        $day->startOfDay(),
                        $day->endOfDay()
                    )->count();
                }
                break;
                
            case 'month':
                for ($i = 29; $i >= 0; $i--) {
                    $day = now()->subDays($i);
                    $stats[$day->format('m/d')] = $this->userRepository->getCreatedBetween(
                        $day->startOfDay(),
                        $day->endOfDay()
                    )->count();
                }
                break;
                
            case 'year':
                for ($i = 11; $i >= 0; $i--) {
                    $month = now()->subMonths($i);
                    $stats[$month->format('M')] = $this->userRepository->getCreatedBetween(
                        $month->startOfMonth(),
                        $month->endOfMonth()
                    )->count();
                }
                break;
        }
        
        return $stats;
    }
    
    /**
     * Get user engagement metrics
     */
    public function getUserEngagementMetrics(): array
    {
        $totalUsers = $this->userRepository->count();
        $activeUsers = $this->userRepository->getActiveSince(now()->subDays(30))->count();
        $newUsers = $this->userRepository->getCreatedBetween(now()->subDays(30), now())->count();
        
        return [
            'total_users' => $totalUsers,
            'active_users' => $activeUsers,
            'new_users' => $newUsers,
            'engagement_rate' => $totalUsers > 0 ? round(($activeUsers / $totalUsers) * 100, 2) : 0,
            'growth_rate' => $totalUsers > 0 ? round(($newUsers / $totalUsers) * 100, 2) : 0,
            'average_session_duration' => $this->userRepository->getAverageSessionDuration(),
            'average_posts_per_user' => $this->userRepository->getAveragePostsPerUser(),
            'average_comments_per_user' => $this->userRepository->getAverageCommentsPerUser(),
        ];
    }
}