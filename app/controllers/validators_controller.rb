class ValidatorsController < ApplicationController

  def index
    @validators = Validator.page params[:page]

    @stats = {
      active_validators: 133,
      epoch: 7199,
      total_stake: "848,826,187.9"
    }
  end

end
