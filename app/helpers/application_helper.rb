module ApplicationHelper
  # Convert octas to Aptos with formatted value
  def octas_to_apt(octas)
    aptos = octas.to_f / 10**8
    number_with_precision(aptos, precision: 2, delimiter: ',')
  end

  # Convert Aptos to octas
  def apt_to_octas(aptos)
    (aptos.to_f * 10**8).to_i
  end
end
