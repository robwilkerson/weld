# frozen_string_literal: true

module UserManagement
  class UserService
    attr_reader :repository, :logger

    def initialize(repository, logger)
      @repository = repository
      @logger = logger
    end

    # Find a user by their ID
    def find_user(id)
      logger.info("Finding user with ID: #{id}")
      user = repository.find_by_id(id)
      
      unless user
        logger.warn("User not found: #{id}")
        raise UserNotFoundError, "User with ID #{id} not found"
      end
      
      user
    end

    # This method will be deleted in mixed-2.rb
    def legacy_authenticate(username, password)
      user = repository.find_by_username(username)
      return false unless user
      
      # Simple password check (not secure!)
      user.password == password
    end

    # Update user's email address
    def update_email(user_id, new_email)
      validate_email(new_email)
      
      user = find_user(user_id)
      user.email = new_email
      user.save!
      
      logger.info("Updated email for user #{user_id}")
      true
    end

    # Create a new user account
    def create_user(attributes)
      user = User.new(attributes)
      
      if user.valid?
        repository.save(user)
        logger.info("Created new user: #{user.username}")
        user
      else
        raise ValidationError, user.errors.full_messages.join(", ")
      end
    end

    private

    def validate_email(email)
      unless email =~ /\A[\w+\-.]+@[a-z\d\-]+(\.[a-z\d\-]+)*\.[a-z]+\z/i
        raise ValidationError, "Invalid email format"
      end
    end

    # This helper method will be added in mixed-2.rb
    # (multi-line addition)

    # Notification helper
    def notify_user(user, message)
      NotificationService.send(user.email, message)
    end
  end

  class UserNotFoundError < StandardError; end
  class ValidationError < StandardError; end
end