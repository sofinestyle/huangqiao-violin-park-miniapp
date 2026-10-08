import { readSkuProduct } from './product-sku.mjs';
import { activeOptions, ordered, combinations, combinationKey } from '../../shared/sku-model.mjs';
// Only current enabled identities grant public visibility. Labels never identify a SKU.
export async function visibleProductSkus(db, product, rows) {
    if (product.variantModelVersion !== 2)
        return [];
    const model = (await readSkuProduct(db, product, false, rows));
    const order = new Map((combinations(product.variantMode, product.options) || []).map((v, i) => [combinationKey(v), i]));
    return model.skus.filter(s => s.current && s.enabled).sort((a, b) => order.get(combinationKey(a.option_values)) - order.get(combinationKey(b.option_values)));
}
export async function publicProduct(db, product, { detail = true, rows } = {}) {
    if (product.kind !== 'product')
        return product;
    const keys = ['id', 'kind', 'name', 'code', 'category', 'brand', 'series', 'description', 'images', 'priceMode'];
    const result = Object.fromEntries(keys.filter(k => Object.hasOwn(product, k)).map(k => [k, product[k]]));
    if (product.priceMode === 'reference') {
        result.price = product.price;
        result.priceNote = product.priceNote || '';
    }
    if (!detail)
        return result;
    const versioned = product.variantModelVersion === 2;
    return { ...result, variantMode: versioned ? product.variantMode : null,
        options: versioned && product.variantMode === 'options' ? activeOptions(product.options).map(o => ({ id: o.id, name: o.name, sort: o.sort, values: ordered(o.values.filter(v => v.enabled)).map(v => ({ id: v.id, label: v.label, sort: v.sort })) })) : [],
        skus: (await visibleProductSkus(db, product, rows)).map(s => ({ id: s.id, optionValues: s.option_values, effectiveReferencePrice: s.effectiveReferencePrice ?? null, effectiveImages: s.effectiveImages })) };
}
