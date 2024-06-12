class ValidatorsController < ApplicationController
  before_action :set_validator, only: [:edit, :update]

  def index
    @validators = Validator.page params[:page]

    @stats = Epoch.order(epoch: :desc).limit(1).first
    @stats.active_validators = Validator.count
  end

  def edit
  end

  def update
    if @validator.update(validator_params)
      # If an avatar is uploaded, remove the Faker avatar_url
      if validator_params[:avatar]
        @validator.update(avatar_url: nil)
      end
      redirect_to validators_path, notice: 'Validator was successfully updated.'
    else
      render :edit
    end
  end

  private

  def set_validator
    @validator = Validator.find(params[:id])
  end

  def validator_params
    params.require(:validator).permit(:name, :network, :avatar, :avatar_url, :validator_index, :address, :voting_power, :consensus_public_key, :fullnode_address, :network_address, :domain)
  end

end
