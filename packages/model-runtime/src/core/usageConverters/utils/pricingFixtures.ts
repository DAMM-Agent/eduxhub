import type { Pricing } from 'model-bank';

// Historical prices exercise the shared calculator independently of available providers.
// These fixtures are test-only and do not register models or runtimes.
export const tieredModelPrices: { id: string; pricing: Pricing }[] = [
  {
    id: 'gemini-3.1-flash-lite',
    pricing: {
      units: [
        {
          name: 'textInput_cacheRead',
          rate: 0.025,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'audioInput_cacheRead',
          rate: 0.05,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'textInput',
          rate: 0.25,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'imageInput',
          rate: 0.25,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'videoInput',
          rate: 0.25,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'audioInput',
          rate: 0.5,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'textOutput',
          rate: 1.5,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'textInput_cacheWrite',
          rate: 1,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
      ],
    },
  },
  {
    id: 'gemini-2.5-pro',
    pricing: {
      units: [
        {
          name: 'textInput_cacheRead',
          strategy: 'tiered',
          tiers: [
            {
              rate: 0.31,
              upTo: 200000,
            },
            {
              rate: 0.625,
              upTo: 'infinity',
            },
          ],
          unit: 'millionTokens',
        },
        {
          name: 'textInput',
          strategy: 'tiered',
          tiers: [
            {
              rate: 1.25,
              upTo: 200000,
            },
            {
              rate: 2.5,
              upTo: 'infinity',
            },
          ],
          unit: 'millionTokens',
        },
        {
          name: 'imageInput',
          strategy: 'tiered',
          tiers: [
            {
              rate: 1.25,
              upTo: 200000,
            },
            {
              rate: 2.5,
              upTo: 'infinity',
            },
          ],
          unit: 'millionTokens',
        },
        {
          name: 'videoInput',
          strategy: 'tiered',
          tiers: [
            {
              rate: 1.25,
              upTo: 200000,
            },
            {
              rate: 2.5,
              upTo: 'infinity',
            },
          ],
          unit: 'millionTokens',
        },
        {
          name: 'audioInput',
          strategy: 'tiered',
          tiers: [
            {
              rate: 1.25,
              upTo: 200000,
            },
            {
              rate: 2.5,
              upTo: 'infinity',
            },
          ],
          unit: 'millionTokens',
        },
        {
          name: 'textOutput',
          strategy: 'tiered',
          tiers: [
            {
              rate: 10,
              upTo: 200000,
            },
            {
              rate: 15,
              upTo: 'infinity',
            },
          ],
          unit: 'millionTokens',
        },
        {
          lookup: {
            prices: {
              '1h': 4.5,
            },
            pricingParams: ['ttl'],
          },
          name: 'textInput_cacheWrite',
          strategy: 'lookup',
          unit: 'millionTokens',
        },
      ],
    },
  },
  {
    id: 'gemini-2.5-flash-image',
    pricing: {
      approximatePricePerImage: 0.039,
      units: [
        {
          name: 'textInput',
          rate: 0.3,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'imageInput',
          rate: 0.3,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'textOutput',
          rate: 2.5,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'imageOutput',
          rate: 30,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
      ],
    },
  },
];

export const longContextModelPrices: { id: string; pricing: Pricing }[] = [
  {
    id: 'gpt-5.4',
    pricing: {
      units: [
        {
          name: 'textInput',
          strategy: 'tiered',
          tiers: [
            {
              rate: 2.5,
              upTo: 272000,
            },
            {
              rate: 5,
              upTo: 'infinity',
            },
          ],
          unit: 'millionTokens',
        },
        {
          name: 'textInput_cacheRead',
          strategy: 'tiered',
          tiers: [
            {
              rate: 0.25,
              upTo: 272000,
            },
            {
              rate: 0.5,
              upTo: 'infinity',
            },
          ],
          unit: 'millionTokens',
        },
        {
          name: 'textOutput',
          strategy: 'tiered',
          tiers: [
            {
              rate: 15,
              upTo: 272000,
            },
            {
              rate: 22.5,
              upTo: 'infinity',
            },
          ],
          unit: 'millionTokens',
        },
      ],
    },
  },
];

export const cacheWriteModelPrices: { id: string; pricing: Pricing }[] = [
  {
    id: 'claude-haiku-5-5',
    pricing: {
      units: [
        {
          name: 'textInput_cacheRead',
          strategy: 'tiered',
          tiers: [
            {
              rate: 0.01,
              upTo: 100000,
            },
            {
              rate: 0.05,
              upTo: 'infinity',
            },
          ],
          unit: 'millionTokens',
        },
        {
          name: 'textInput',
          strategy: 'tiered',
          tiers: [
            {
              rate: 0.1,
              upTo: 100000,
            },
            {
              rate: 0.5,
              upTo: 'infinity',
            },
          ],
          unit: 'millionTokens',
        },
        {
          name: 'textOutput',
          strategy: 'tiered',
          tiers: [
            {
              rate: 0.5,
              upTo: 100000,
            },
            {
              rate: 2.5,
              upTo: 'infinity',
            },
          ],
          unit: 'millionTokens',
        },
        {
          name: 'textInput_cacheWrite',
          strategy: 'tiered',
          tiers: [
            {
              rate: 0.125,
              upTo: 100000,
            },
            {
              rate: 0.625,
              upTo: 'infinity',
            },
          ],
          unit: 'millionTokens',
        },
      ],
    },
  },
  {
    id: 'claude-opus-4-6',
    pricing: {
      units: [
        {
          name: 'textInput_cacheRead',
          rate: 0.5,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'textInput',
          rate: 5,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'textOutput',
          rate: 25,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          lookup: {
            prices: {
              '1h': 10,
              '5m': 6.25,
            },
            pricingParams: ['ttl'],
          },
          name: 'textInput_cacheWrite',
          strategy: 'lookup',
          unit: 'millionTokens',
        },
      ],
    },
  },
];
