# frozen_string_literal: true

require 'active_support/all'

module UserManagement
  class UserService
    attr_reader :repository, :logger, :cache

    def initialize(repository, logger, cache = nil)
      @repository = repository
      @logger = logger
      @cache = cache || Rails.cache
    end

    # Find a user by their ID
    def find_user(id)
      logger.info("Finding user with ID: #{id}")
      
      # Check cache first (single-line addition)
      cached_user = cache.read("user_#{id}")
      return cached_user if cached_user
      
      user = repository.find_by_id(id)
      
      unless user
        logger.warn("User not found: #{id}")
        raise UserNotFoundError, "User with ID #{id} not found"
      end
      
      # Cache the user for future requests
      cache.write("user_#{id}", user, expires_in: 1.hour)
      user
    end

    # Update user's email address with validation and notifications
    def update_email(user_id, new_email)
      validate_email_format(new_email)
      check_email_uniqueness(new_email)
      
      user = find_user(user_id)
      old_email = user.email
      user.email = new_email
      user.updated_at = Time.current
      user.save!
      
      # Send notification about email change
      notify_user(user, "Your email has been changed from #{old_email} to #{new_email}")
      
      logger.info("Updated email for user #{user_id}: #{old_email} -> #{new_email}")
      true
    end

    # Notification helper (moved from bottom)
    def notify_user(user, message)
      NotificationService.send(user.email, message)
    end

    # Create a new user account with enhanced validation
    def create_user(attributes)
      user = User.new(attributes)
      
      if user.valid?
        repository.save(user)
        logger.info("Created new user: #{user.username}")
        
        # Send welcome email
        notify_user(user, "Welcome to our platform, #{user.first_name}!")
        
        user
      else
        raise ValidationError, user.errors.full_messages.join(", ")
      end
    end

    private

    def validate_email_format(email)
      unless email.match?(/\A[\w+\-.]+@[a-z\d\-]+(\.[a-z\d\-]+)*\.[a-z]+\z/i)
        raise ValidationError, "Invalid email format"
      end
    end

    # Check if email is already taken (multi-line addition)
    def check_email_uniqueness(email)
      existing_user = repository.find_by_email(email)
      if existing_user
        raise ValidationError, "Email #{email} is already taken"
      end
    end
  end

  class UserNotFoundError < StandardError; end
  class ValidationError < StandardError; end
end