using System;
using System.Collections.Generic;
using System.Linq;

namespace SampleApp
{
    public class UserService
    {
        private readonly IUserRepository _userRepository;
        private readonly ILogger _logger;
        
        public UserService(IUserRepository userRepository, ILogger logger)
        {
            _userRepository = userRepository;
            _logger = logger;
        }
        
        public User GetUserById(int userId)
        {
            _logger.LogInfo($"Fetching user with ID: {userId}");
            
            var user = _userRepository.FindById(userId);
            
            if (user == null)
            {
                _logger.LogWarning($"User not found: {userId}");
                throw new UserNotFoundException($"User with ID {userId} was not found.");
            }
            
            return user;
        }
        
        public List<User> GetActiveUsers()
        {
            _logger.LogInfo("Fetching all active users");
            
            var users = _userRepository.GetAll()
                .Where(u => u.IsActive == true)
                .OrderBy(u => u.Username)
                .ToList();
                
            _logger.LogInfo($"Found {users.Count} active users");
            
            return users;
        }
        
        public bool UpdateUserEmail(int userId, string newEmail)
        {
            if (string.IsNullOrEmpty(newEmail))
            {
                throw new ArgumentException("Email cannot be empty");
            }
            
            var user = GetUserById(userId);
            user.Email = newEmail;
            user.ModifiedDate = DateTime.Now;
            
            var success = _userRepository.Update(user);
            
            if (success)
            {
                _logger.LogInfo($"Updated email for user {userId} to {newEmail}");
            }
            else
            {
                _logger.LogError($"Failed to update email for user {userId}");
            }
            
            return success;
        }
    }
}