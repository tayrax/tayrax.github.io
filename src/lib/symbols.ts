export const BINANCE_SYMBOL: Record<string, string> = {
  bitcoin: 'BTCUSDT',
  ethereum: 'ETHUSDT',
  solana: 'SOLUSDT',
  cardano: 'ADAUSDT'
};

export const toBinanceSymbol = (asset: string): string | null =>
  BINANCE_SYMBOL[asset] ?? null;

export const fromBinanceSymbol = (symbol: string): string | null => {
  const upper = symbol.toUpperCase();
  for (const [asset, sym] of Object.entries(BINANCE_SYMBOL)) {
    if (sym === upper) return asset;
  }
  return null;
};
