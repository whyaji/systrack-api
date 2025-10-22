export const formatBytesToString = (
  value: number,
  config: {
    unit: 'Bytes' | 'KB' | 'MB' | 'GB' | 'TB';
    targetUnit: 'Bytes' | 'KB' | 'MB' | 'GB' | 'TB';
    precision: number;
  } = {
    unit: 'MB',
    targetUnit: 'GB',
    precision: 2,
  }
) => {
  const unitMap = {
    Bytes: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };

  // Convert input value to bytes first
  const bytes = value * unitMap[config.unit];

  // Convert from bytes to target unit
  const convertedValue = bytes / unitMap[config.targetUnit];

  // Round with precision, then remove trailing zeros and decimal point if unnecessary
  const formatted = Number(convertedValue.toFixed(config.precision)).toString();

  return `${formatted} ${config.targetUnit}`;
};
