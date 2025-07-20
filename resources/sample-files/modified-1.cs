using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SampleApp
{
    public class UserService
    {
        private readonly IUserRepository _userRepository;
        private readonly ILogger<UserService> _logger;

        public UserService(IUserRepository userRepository, ILogger<UserService> logger)
        {
            _userRepository = userRepository ?? throw new ArgumentNullException(nameof(userRepository));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<User> GetUserByIdAsync(int userId)
        {
            _logger.LogInformation($"Fetching user with ID: {userId}");

            var user = await _userRepository.FindByIdAsync(userId);

            if (user == null)
            {
                _logger.LogWarning($"User not found: {userId}");
                throw new UserNotFoundException($"User with ID {userId} was not found.");
            }

            return user;
        }

        public async Task<IEnumerable<User>> GetActiveUsersAsync()
        {
            _logger.LogInformation("Fetching all active users");

            var users = await _userRepository.GetAllAsync();
            var activeUsers = users
                .Where(u => u.IsActive && !u.IsDeleted)
                .OrderBy(u => u.Username)
                .ThenBy(u => u.CreatedDate)
                .ToList();

            _logger.LogInformation($"Found {activeUsers.Count} active users");

            return activeUsers;
        }

        public async Task<bool> UpdateUserEmailAsync(int userId, string newEmail)
        {
            if (string.IsNullOrEmpty(newEmail))
            {
                throw new ArgumentException("Email cannot be empty or whitespace", nameof(newEmail));
            }

            var user = await GetUserByIdAsync(userId);
            user.Email = newEmail;
            user.ModifiedDate = DateTime.Now;
            user.ModifiedBy = "admin";

            var success = await _userRepository.UpdateAsync(user);

            if (success)
            {
                _logger.LogInfo($"Successfully updated email for user {userId} to {newEmail}");
            }
            else
            {
                _logger.LogError($"Failed to update email for user {userId}");
            }

            return success;
        }
    }
}