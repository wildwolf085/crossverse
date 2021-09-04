export enum ORDER_STATUS {
  COMPLETED = 3,
  EXPIRED = 4,
}

export function getOrderStatusText(
  t?: ORDER_STATUS,
  toLower?: boolean
): string {
  let text = ''

  if (t === ORDER_STATUS.COMPLETED) {
    text = 'Completed'
  }

  if (t === ORDER_STATUS.EXPIRED) {
    text = 'Expired'
  }

  return toLower ? text.toLowerCase() : text
}
