module ApplicationHelper
  require 'time'

  # Provides the network (mainnet || testnet) based on env var configs. See application.rb
  def network
    NETWORK
  end

  # Convert octas to Aptos with formatted value
  def octas_to_apt(octas, precision = 2)
    aptos = octas.to_f / 10 ** 8
    number_with_precision(aptos, precision: precision, delimiter: ',')
  end

  # Convert Aptos to octas
  def apt_to_octas(aptos)
    (aptos.to_f * 10 ** 8).to_i
  end

  # This helper formats a iso8660 time object in UTC
  def display_utc(datetime_string)
    datetime = Time.iso8601(datetime_string).utc
    datetime.strftime('%Y-%m-%d %H:%M:%S UTC') if datetime.present?
  rescue ArgumentError, TypeError
    datetime_string
  end

  # For table columns sortable headers
  def sortable(column, title = nil)
    # Default title to the column name if not provided
    title ||= column.titleize
    params[:sort] = 'overall_score' if params[:sort].blank?

    # Determine sorting direction
    direction = column == params[:sort] && params[:direction] == 'asc' ? 'desc' : 'asc'

    # Add sorting arrow if the column is the active sorted column
    arrow = if column == params[:sort]
              params[:direction] == 'asc' ? '&uarr;' : '&darr;'
            else
              ''
            end

    # Create the link with title and arrow
    link_to "#{title} #{arrow}".html_safe,
            { sort: column, direction: direction, page: params[:page] },
            class: 'hover:underline'
  end

  def format_date(date)
    # Convert the input to a Date or DateTime object if necessary
    parsed_date = case date
                  when String
                    begin
                      Date.parse(date)
                    rescue ArgumentError
                      return "Invalid Date"
                    end
                  when Date, DateTime, Time
                    date
                  else
                    return "Invalid Date"
                  end

    # Format the date using strftime
    parsed_date.strftime("%Y-%m-%d")
  end

  def ellipsize(string, edge_length = 3)
    return string if string.length <= edge_length * 2

    "#{string[0...edge_length]}...#{string[-edge_length..]}"
  end
end
