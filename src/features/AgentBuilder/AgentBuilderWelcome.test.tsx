import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_INBOX_AVATAR } from '@/const/index';
import { useAgentStore } from '@/store/agent';

import AgentBuilderWelcome from './AgentBuilderWelcome';

vi.mock('@/store/agent', async () => {
  const { createWithEqualityFn } = await import('zustand/traditional');

  return {
    useAgentStore: createWithEqualityFn(() => ({ agentMap: {} })),
  };
});

vi.mock('@/features/Conversation', () => ({
  conversationSelectors: { agentId: (state: { agentId: string }) => state.agentId },
  useConversationStore: (selector: (state: { agentId: string }) => unknown) =>
    selector({ agentId: 'agent-builder' }),
}));

vi.mock('./SuggestionChips', () => ({ default: () => null }));

describe('AgentBuilderWelcome', () => {
  beforeEach(() => {
    useAgentStore.setState({ agentMap: {} });
  });

  it('shows the default avatar before the builder config arrives and updates after loading', () => {
    render(<AgentBuilderWelcome />);

    expect(screen.getByText('agentBuilder.title')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', DEFAULT_INBOX_AVATAR);

    act(() => {
      useAgentStore.setState({
        agentMap: { 'agent-builder': { avatar: '/avatars/custom-builder.png' } },
      });
    });

    expect(screen.getByRole('img')).toHaveAttribute('src', '/avatars/custom-builder.png');

    act(() => {
      useAgentStore.setState({ agentMap: {} });
    });

    expect(screen.getByRole('img')).toHaveAttribute('src', DEFAULT_INBOX_AVATAR);
  });

  it.each([undefined, null, ''])(
    'uses the default avatar when the loaded avatar is %s',
    (avatar) => {
      useAgentStore.setState({ agentMap: { 'agent-builder': { avatar } } });

      render(<AgentBuilderWelcome />);

      expect(screen.getByRole('img')).toHaveAttribute('src', DEFAULT_INBOX_AVATAR);
    },
  );
});
