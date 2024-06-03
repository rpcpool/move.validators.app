require 'test_helper'

class UserTest < ActiveSupport::TestCase

  setup do
    @user = User.create(email:"user1@test.com", username: "test", password: "password")
  end

  test "validates username length, minimum 3 chars, maximum 50" do
    message_too_short = "Username is too short (minimum is 3 characters)"
    message_too_long = "Username is too long (maximum is 50 characters)"

    @user.username = "s" * 51
    refute @user.valid?
    assert_equal message_too_long, @user.errors.full_messages.first

    @user.username = "s" * 2
    refute @user.valid?
    assert_equal message_too_short, @user.errors.full_messages.first

    @user.username = "s" * 5
    assert @user.valid?
  end

  test "validates username presence" do
    message = "Username can't be blank"

    @user.username = nil
    refute @user.valid?
    assert_equal message, @user.errors.full_messages.first

    @user.username = ""
    refute @user.valid?
    assert_equal message, @user.errors.full_messages.first
  end

  test "validates username uniqueness, case_sensitive false" do
    message = "Username has already been taken"

    # User with name "test" is already in db (check setup)
    u = User.new(email:"user2@test.com", username: "test", password: "password")

    refute u.valid?
    assert_equal message, u.errors.full_messages.first

    u = User.new(email:"user2@test.com", username: "Test", password: "password")
    refute u.valid?
    assert_equal message, u.errors.full_messages.first
  end

  test "validates username format, allows only letters, digits and dots" do
    message = "Username invalid (letters, numbers and dots allowed)"

    @user.username = "not valid user due to spaces"
    refute @user.valid?
    assert_equal message, @user.errors.full_messages.first

    @user.username = "invalid_USER"
    refute @user.valid?
    assert_equal message, @user.errors.full_messages.first

    @user.username = "invalid!"
    refute @user.valid?
    assert_equal message, @user.errors.full_messages.first

    @user.username = "invalid#"
    refute @user.valid?
    assert_equal message, @user.errors.full_messages.first

    @user.username = "vALID.USER.1"
    assert @user.valid?
  end

  test "validates email format, allows only correct email addresses" do
    valid_emails = %w[vALID.USER.1@gmail.com xxx@atlantis.capital xxx@hypersphere.ventures xxx@solana.foundation xxx.xxx@rbf.capital robert@solstreet.finance]
    message = "Email is invalid"

    @user.email = "not valid email due to spaces"
    refute @user.valid?
    assert_equal message, @user.errors.full_messages.first

    @user.email = "invalid_USER"
    refute @user.valid?
    assert_equal message, @user.errors.full_messages.first

    @user.email = "invalid!"
    refute @user.valid?
    assert_equal message, @user.errors.full_messages.first

    @user.email = "invalid#@@"
    refute @user.valid?
    assert_equal message, @user.errors.full_messages.first

    valid_emails.each do |email|
      @user.email = email
      assert @user.valid?
    end
  end

  test "api_token is created with a new user" do
    assert_not_nil @user.reload.api_token
  end

  test "api_token is not changed during update" do
    # Save & reload the user to confirm that the token did not change
    api_token = @user.api_token

    @user.update(username: "test2")
    @user.reload

    assert_equal "test2", @user.username
    assert_equal api_token, @user.api_token
  end

  test ".search_by_email_hash" do
    user = User.search_by_email_hash(@user.email)
    assert_equal "user1@test.com", user.email
  end

  test "correctly creates user with username, encrypts email, creates hash" do
    user_params = {
      username: "test2",
      email: "test@test.com",
      password: "password"
    }

    assert_difference("User.count") do
      User.create(user_params)
    end

    user = User.find_by(username: "test2")
    assert_equal "test2", user.username
    refute_equal user_params[:email], @user.email_encrypted
    assert_equal user.email_hash, Digest::SHA256.hexdigest(user_params[:email])
    assert user.email_encrypted_iv
  end
end