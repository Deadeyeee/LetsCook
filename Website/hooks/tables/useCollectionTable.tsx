import { useCallback, useMemo, useState, useEffect } from "react";
import { CollectionData, getCollectionPlugins } from "@letscook/sdk/dist/state/collections";
import useAppRoot from "../../context/useAppRoot";
import { CollectionKeys } from "@/components/Solana/constants";
import { bignum_to_num } from "@letscook/sdk";
import { getTradeMintData } from "@/utils/getTokenMintData";

export interface CollectionRow {
    id: string;
    name: string;
    iconUrl: string;
    hype: { positiveVotes: number; negativeVotes: number; score: number; launchId: number };
    price: { value: number; display: string; tokenIcon: string; tokenSymbol: string };
    unwrapFee: { value: number; display: string; isMintOnly: boolean };
    supply: { total: number; available: string };
    hasDescription: boolean;
}

export interface CollectionTableReturn {
    rows: CollectionRow[];
    isLoading: boolean;
    error: Error | null;
    sortConfig: { field: string | null; direction: "asc" | "desc" };
    handleSort: (field: string | null) => void;
}

export const useCollectionTable = (): CollectionTableReturn => {
    const { collectionList } = useAppRoot();
    const [rows, setRows] = useState<CollectionRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [sortConfig, setSortConfig] = useState({ field: "hype", direction: "desc" as "asc" | "desc" });

    useEffect(() => {
        if (!collectionList || collectionList.size === 0) {
            setRows([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const fetchRows = async () => {
            try {
                const mintAddresses = Array.from(collectionList.values()).map((collection) =>
                    collection.keys[CollectionKeys.MintAddress].toString(),
                );
                const mintData = await getTradeMintData(mintAddresses);

                const processed: CollectionRow[] = [];
                collectionList.forEach((collection) => {
                    const pluginData = getCollectionPlugins(collection);
                    const tokenMint = mintData.get(collection.keys[CollectionKeys.MintAddress].toString());

                    // You can skip collections with missing mint data, or show them with fallback values:
                    // if (!tokenMint) return;

                    const numAvailable =
                        collection.collection_meta["__kind"] === "RandomUnlimited" ? "Unlimited" : collection.num_available.toString();

                    const normalizedPrice = bignum_to_num(collection.swap_price) / Math.pow(10, collection.token_decimals);

                    processed.push({
                        id: collection.page_name,
                        name: collection.collection_name,
                        iconUrl: collection.collection_icon_url,
                        hype: {
                            positiveVotes: collection.positive_votes,
                            negativeVotes: collection.negative_votes,
                            score: collection.positive_votes - collection.negative_votes,
                            launchId: bignum_to_num(collection.launch_id),
                        },
                        price: {
                            value: normalizedPrice,
                            display: normalizedPrice.toFixed(3),
                            tokenIcon: tokenMint?.icon ?? "",
                            tokenSymbol: tokenMint?.symbol ?? "",
                        },
                        unwrapFee: {
                            value: collection.swap_fee,
                            display: pluginData.mintOnly ? "--" : (collection.swap_fee / 100).toString(),
                            isMintOnly: pluginData.mintOnly,
                        },
                        supply: {
                            total: Number(collection.total_supply),
                            available: numAvailable,
                        },
                        hasDescription: collection.description !== "",
                    });
                });

                setRows(processed);
            } catch (err) {
                setError(err instanceof Error ? err : new Error("Failed to process collection data"));
            } finally {
                setIsLoading(false);
            }
        };

        fetchRows();
    }, [collectionList]);

    const sortedRows = useMemo(() => {
        if (!sortConfig.field) return rows;
        return [...rows].sort((a, b) => {
            let comparison = 0;
            switch (sortConfig.field) {
                case "name":
                    return sortConfig.direction === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                case "hype":
                    comparison = a.hype.score - b.hype.score;
                    break;
                case "tokensPerNft":
                    comparison = a.price.value - b.price.value;
                    break;
                case "unwrapFee":
                    comparison = a.unwrapFee.value - b.unwrapFee.value;
                    break;
                case "totalSupply":
                    comparison = a.supply.total - b.supply.total;
                    break;
                case "numAvailable":
                    const aValue = a.supply.available === "Unlimited" ? Infinity : Number(a.supply.available);
                    const bValue = b.supply.available === "Unlimited" ? Infinity : Number(b.supply.available);
                    comparison = aValue - bValue;
                    break;
                default:
                    return 0;
            }
            return sortConfig.direction === "asc" ? comparison : -comparison;
        });
    }, [rows, sortConfig]);

    const handleSort = useCallback((field: string | null) => {
        if (!field) return;
        setSortConfig((prev) => ({
            field,
            direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
        }));
    }, []);

    return { rows: sortedRows, isLoading, error, sortConfig, handleSort };
};
