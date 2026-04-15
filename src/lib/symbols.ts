// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

export const BINANCE_SYMBOL: Record<string, string> = {
  bitcoin: 'BTCUSDT',
  ethereum: 'ETHUSDT',
  'binance-coin': 'BNBUSDT',
  solana: 'SOLUSDT',
  xrp: 'XRPUSDT',
  dogecoin: 'DOGEUSDT',
  tron: 'TRXUSDT',
  toncoin: 'TONUSDT',
  cardano: 'ADAUSDT',
  avalanche: 'AVAXUSDT',
  'shiba-inu': 'SHIBUSDT',
  chainlink: 'LINKUSDT',
  polkadot: 'DOTUSDT',
  'bitcoin-cash': 'BCHUSDT',
  litecoin: 'LTCUSDT',
  'near-protocol': 'NEARUSDT',
  uniswap: 'UNIUSDT',
  stellar: 'XLMUSDT',
  cosmos: 'ATOMUSDT',
  'internet-computer': 'ICPUSDT',
  'ethereum-classic': 'ETCUSDT',
  filecoin: 'FILUSDT',
  'hedera-hashgraph': 'HBARUSDT',
  aptos: 'APTUSDT',
  sui: 'SUIUSDT',
  arbitrum: 'ARBUSDT',
  vechain: 'VETUSDT',
  optimism: 'OPUSDT',
  injective: 'INJUSDT',
  maker: 'MKRUSDT',
  polygon: 'MATICUSDT',
  algorand: 'ALGOUSDT',
  theta: 'THETAUSDT',
  aave: 'AAVEUSDT',
  'the-graph': 'GRTUSDT',
  flow: 'FLOWUSDT',
  'immutable-x': 'IMXUSDT',
  decentraland: 'MANAUSDT',
  'lido-dao': 'LDOUSDT',
  'sei-network': 'SEIUSDT',
  celestia: 'TIAUSDT',
  stacks: 'STXUSDT',
  'render-token': 'RENDERUSDT',
  'fetch-ai': 'FETUSDT',
  fantom: 'FTMUSDT',
  eos: 'EOSUSDT',
  sandbox: 'SANDUSDT',
  gala: 'GALAUSDT',
  mantle: 'MNTUSDT',
  worldcoin: 'WLDUSDT',
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
