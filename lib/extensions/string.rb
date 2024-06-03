class String
  def ellipsize(edge_length = 3)
    return self if length <= edge_length * 2

    "#{self[0...edge_length]}...#{self[-edge_length..]}"
  end
end
