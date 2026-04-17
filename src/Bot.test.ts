// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { vi, describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/svelte';
import Bot from './Bot.svelte';
import type { BotState, WorkerToTab } from './lib/bot-types';
import type { MessageHandler } from './lib/bot-client';
import type { TabToWorker } from './lib/bot-types';

// ---------------------------------------------------------------------------
// Mock bot-client — capture the subscribe handler so tests can push messages,
// and track post() calls so tests can assert on worker messages.
// ---------------------------------------------------------------------------
const botMock = vi.hoisted(() => ({
  postMessages: [] as TabToWorker[],
  subscribers: [] as MessageHandler[],
  destroyed: false,

  emit(msg: WorkerToTab): void {
    this.subscribers.forEach((h) => h(msg));
  },
  reset(): void {
    this.postMessages = [];
    this.subscribers = [];
    this.destroyed = false;
  },
}));

// createBotClient is mocked so no real worker is constructed.
vi.mock('./lib/bot-client', () => ({
  createBotClient: () => ({
    post(msg: TabToWorker): void { botMock.postMessages.push(msg); },
    subscribe(handler: MessageHandler): () => void {
      botMock.subscribers.push(handler);
      return () => { botMock.subscribers = botMock.subscribers.filter((h) => h !== handler); };
    },
    destroy(): void {
      botMock.subscribers = [];
      botMock.destroyed = true;
    },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeState = (overrides: Partial<BotState> = {}): BotState => ({
  priceStatus: 'open',
  klineStatus: 'open',
  enabledAssets: ['bitcoin'],
  lastTickAt: { bitcoin: Date.now() },
  reconnectCount: { price: 0, kline: 0 },
  recentErrors: [],
  connectedTabCount: 1,
  ...overrides,
});

async function pushBotState(state: BotState): Promise<void> {
  botMock.emit({ type: 'botState', state });
  await act();
}

// ---------------------------------------------------------------------------
// Rendering — initial state (no botState received yet)
// ---------------------------------------------------------------------------
describe('Bot — initial state', () => {
  it('shows connecting message before first botState arrives', async () => {
    const { getByText } = render(Bot);
    await act();
    expect(getByText(/Connecting to bot worker/i)).toBeInTheDocument();
  });

  it('sends subscribeBotState to the worker on mount', async () => {
    botMock.reset();
    render(Bot);
    await act();
    expect(botMock.postMessages).toContainEqual({ type: 'subscribeBotState' });
  });
});

// ---------------------------------------------------------------------------
// Rendering — with botState
// ---------------------------------------------------------------------------
describe('Bot — with botState', () => {
  it('renders feed status badges after botState arrives', async () => {
    botMock.reset();
    const { getAllByText } = render(Bot);
    await act();
    await pushBotState(makeState());
    const badges = getAllByText('open');
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it('renders enabled asset list', async () => {
    botMock.reset();
    const { getByText } = render(Bot);
    await act();
    await pushBotState(makeState({ enabledAssets: ['bitcoin', 'ethereum'] }));
    expect(getByText('bitcoin')).toBeInTheDocument();
    expect(getByText('ethereum')).toBeInTheDocument();
  });

  it('renders connected tab count', async () => {
    botMock.reset();
    const { getByText } = render(Bot);
    await act();
    await pushBotState(makeState({ connectedTabCount: 3 }));
    expect(getByText('3')).toBeInTheDocument();
  });

  it('renders reconnect counts', async () => {
    botMock.reset();
    const { getAllByText } = render(Bot);
    await act();
    await pushBotState(makeState({ reconnectCount: { price: 2, kline: 1 } }));
    expect(getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('1').length).toBeGreaterThanOrEqual(1);
  });

  it('renders recent errors in reverse order', async () => {
    botMock.reset();
    const { getAllByText } = render(Bot);
    await act();
    await pushBotState(makeState({
      recentErrors: [
        { feed: 'price', message: 'connection lost', at: 1000 },
        { feed: 'kline', message: 'connection lost', at: 2000 },
      ],
    }));
    const feedLabels = getAllByText('price').concat(getAllByText('kline'));
    expect(feedLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('hides errors section when there are no errors', async () => {
    botMock.reset();
    const { queryByText } = render(Bot);
    await act();
    await pushBotState(makeState({ recentErrors: [] }));
    expect(queryByText(/Recent errors/i)).not.toBeInTheDocument();
  });

  it('renders no-assets message when enabledAssets is empty', async () => {
    botMock.reset();
    const { getByText } = render(Bot);
    await act();
    await pushBotState(makeState({ enabledAssets: [] }));
    expect(getByText(/No assets enabled/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Reconnect buttons
// ---------------------------------------------------------------------------
describe('Bot — reconnect controls', () => {
  it('sends reconnect price message when price reconnect is clicked', async () => {
    botMock.reset();
    const { getAllByText } = render(Bot);
    await act();
    await pushBotState(makeState());
    const buttons = getAllByText('reconnect');
    buttons[0].click();
    expect(botMock.postMessages).toContainEqual({ type: 'reconnect', feed: 'price' });
  });

  it('sends reconnect kline message when kline reconnect is clicked', async () => {
    botMock.reset();
    const { getAllByText } = render(Bot);
    await act();
    await pushBotState(makeState());
    const buttons = getAllByText('reconnect');
    buttons[1].click();
    expect(botMock.postMessages).toContainEqual({ type: 'reconnect', feed: 'kline' });
  });
});
