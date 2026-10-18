import { catalogVersioning, products, productsV3 } from '@wix/stores';

import type { ProductVariantOption, ProductVariantState } from '../auction/types';

export const VARIANT_SELECTION_REQUIRED_MESSAGE =
  'Select product options on the product page before placing a bid.';

type CatalogVersion = ProductVariantState['catalogVersion'];

type ResolvedBidVariant = {
  variantId: string | null;
  variantLabel: string | null;
  variantChoices: Record<string, string> | null;
};

function unwrapProduct(raw: unknown): any {
  const value = raw as { product?: unknown } | null;
  return value?.product ?? raw;
}

function toChoiceMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, choice]) => choice != null && choice !== '')
      .map(([key, choice]) => [key, String(choice)]),
  );
}

function choicesMatch(
  variantChoices: Record<string, string>,
  selectedChoices: Record<string, string>,
): boolean {
  const selectedEntries = Object.entries(selectedChoices);

  if (selectedEntries.length === 0) {
    return false;
  }

  const normalizedVariant = Object.fromEntries(
    Object.entries(variantChoices).map(([key, choice]) => [
      key.toLowerCase(),
      choice.toLowerCase(),
    ]),
  );

  return selectedEntries.every(([key, choice]) => {
    const variantChoice = normalizedVariant[key.toLowerCase()];
    return variantChoice != null && variantChoice === choice.toLowerCase();
  });
}

function extractV1Variants(product: any): ProductVariantOption[] {
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  return variants
    .map((item: any) => {
      const id = String(item?._id ?? item?.id ?? '').trim();
      const choices = toChoiceMap(item?.choices);
      const label = Object.values(choices).filter(Boolean).join(' / ') || id;

      return { id, label, choices };
    })
    .filter((variant: ProductVariantOption) => Boolean(variant.id));
}

function extractV3Variants(product: any): ProductVariantOption[] {
  const variants = Array.isArray(product?.variantsInfo?.variants)
    ? product.variantsInfo.variants
    : [];
  const options = Array.isArray(product?.options) ? product.options : [];
  const optionNameById = new Map<string, string>();
  const choiceNameById = new Map<string, string>();

  for (const option of options) {
    const optionId = String(option?._id ?? option?.id ?? '');
    const optionName = String(option?.name ?? optionId);

    if (optionId) {
      optionNameById.set(optionId, optionName);
    }

    const choices = option?.choicesSettings?.choices ?? option?.choices ?? [];

    for (const choice of choices) {
      const choiceId = String(choice?.choiceId ?? choice?._id ?? choice?.id ?? '');
      const choiceName = String(choice?.name ?? choice?.key ?? choiceId);

      if (choiceId) {
        choiceNameById.set(choiceId, choiceName);
      }
    }
  }

  return variants
    .map((item: any) => {
      const id = String(item?._id ?? item?.id ?? '').trim();
      const choices = toChoiceMap(item?.choices);

      for (const pair of item?.optionChoiceIds ?? []) {
        const optionName =
          optionNameById.get(String(pair?.optionId ?? '')) ?? String(pair?.optionId ?? '');
        const choiceName =
          choiceNameById.get(String(pair?.choiceId ?? '')) ?? String(pair?.choiceId ?? '');

        if (optionName && choiceName) {
          choices[optionName] = choiceName;
        }
      }

      const label = Object.values(choices).filter(Boolean).join(' / ') || id;
      return { id, label, choices };
    })
    .filter((variant: ProductVariantOption) => Boolean(variant.id));
}

function areVariantsRequired(variants: ProductVariantOption[]): boolean {
  if (variants.length <= 1) {
    return false;
  }

  return variants.some((variant) => Object.keys(variant.choices).length > 0);
}

async function fetchV1Product(productId: string): Promise<any> {
  const response = await products.getProduct(productId);
  const product = unwrapProduct(response);

  if (extractV1Variants(product).length > 0) {
    return product;
  }

  const queryVariants = (
    products as typeof products & {
      queryProductVariants?: (id: string) => Promise<any>;
    }
  ).queryProductVariants;

  if (typeof queryVariants !== 'function') {
    return product;
  }

  try {
    const variantResponse = await queryVariants(productId);
    const queriedVariants = variantResponse?.variants ?? [];

    if (Array.isArray(queriedVariants) && queriedVariants.length > 0) {
      return { ...product, variants: queriedVariants };
    }
  } catch (error) {
    console.warn('[auction] queryProductVariants failed', {
      productId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return product;
}

async function fetchV3Product(productId: string): Promise<any> {
  const api = productsV3 as typeof productsV3 & {
    getProduct?: (id: string) => Promise<any>;
  };

  if (typeof api.getProduct === 'function') {
    const response = await api.getProduct(productId);
    return unwrapProduct(response);
  }

  const query = productsV3.queryProducts() as {
    eq?: (field: string, value: string) => { limit: (size: number) => { find: () => Promise<{ items?: any[] }> } };
    limit: (size: number) => { find: () => Promise<{ items?: any[] }> };
  };

  if (typeof query.eq === 'function') {
    const result = await query.eq('_id', productId).limit(1).find();
    const item = result.items?.[0];

    if (item) {
      return unwrapProduct(item);
    }
  }

  const fallback = await productsV3.queryProducts().limit(100).find();
  return unwrapProduct(
    fallback.items?.find((item: any) => String(item?._id ?? item?.id) === productId) ?? null,
  );
}

export async function getProductVariantState(
  productId: string,
): Promise<ProductVariantState> {
  const versionResult = await catalogVersioning.getCatalogVersion();
  const catalogVersion = (versionResult?.catalogVersion ?? 'V1_CATALOG') as CatalogVersion;

  if (!productId || catalogVersion === 'STORES_NOT_INSTALLED') {
    return {
      productId,
      catalogVersion,
      variants: [],
      variantsRequired: false,
    };
  }

  const product =
    catalogVersion === 'V3_CATALOG'
      ? await fetchV3Product(productId)
      : await fetchV1Product(productId);
  const variants =
    catalogVersion === 'V3_CATALOG'
      ? extractV3Variants(product)
      : extractV1Variants(product);

  return {
    productId,
    catalogVersion,
    variants,
    variantsRequired: areVariantsRequired(variants),
  };
}

export function resolveBidVariant(
  state: ProductVariantState,
  selectedVariantId?: string | null,
  selectedChoices?: Record<string, string> | null,
): ResolvedBidVariant {
  const variants = state.variants;

  if (variants.length === 0) {
    return {
      variantId: null,
      variantLabel: null,
      variantChoices: null,
    };
  }

  const normalizedVariantId = selectedVariantId?.trim() || null;

  if (normalizedVariantId) {
    const match = variants.find((variant) => variant.id === normalizedVariantId);

    if (!match) {
      throw new Error('The selected product option is not available.');
    }

    return {
      variantId: match.id,
      variantLabel: match.label,
      variantChoices: match.choices,
    };
  }

  if (selectedChoices && Object.keys(selectedChoices).length > 0) {
    const match = variants.find((variant) =>
      choicesMatch(variant.choices, selectedChoices),
    );

    if (match) {
      return {
        variantId: match.id,
        variantLabel: match.label,
        variantChoices: match.choices,
      };
    }
  }

  if (!state.variantsRequired && variants.length === 1) {
    return {
      variantId: variants[0].id,
      variantLabel: variants[0].label,
      variantChoices: variants[0].choices,
    };
  }

  if (state.variantsRequired) {
    throw new Error(VARIANT_SELECTION_REQUIRED_MESSAGE);
  }

  return {
    variantId: null,
    variantLabel: null,
    variantChoices: null,
  };
}

export function catalogReferenceOptions(
  variantId?: string | null,
  variantChoices?: Record<string, string> | null,
): Record<string, unknown> | undefined {
  const normalizedVariantId = variantId?.trim();

  if (normalizedVariantId) {
    return { variantId: normalizedVariantId };
  }

  if (variantChoices && Object.keys(variantChoices).length > 0) {
    return { options: variantChoices };
  }

  return undefined;
}
