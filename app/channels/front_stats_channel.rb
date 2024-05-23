# frozen_string_literal: true

class FrontStatsChannel < ApplicationCable::Channel
  def subscribed
    puts "subscribed"
    stream_from "front_stats_channel"
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
