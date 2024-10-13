import { useState, useEffect, useRef } from 'react';
import { getTransferFeeConfig,calculateFee } from "@solana/spl-token";
import { bignum_to_num} from "../../components/Solana/state";
import { CollectionKeys} from "../../components/Solana/constants";
import useAppRoot from '../../context/useAppRoot';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
export const useOutputCalculation = (collection) => {
    const wallet = useWallet();
    const [outAmount, setOutAmount] = useState(0);
    const { mintData } = useAppRoot();
    const collection_key = useRef<PublicKey | null>(null);
    useEffect(() => {
        if (!collection || !mintData) return;

        collection_key.current = collection.keys[CollectionKeys.CollectionMint];
        let mint = mintData.get(collection.keys[CollectionKeys.MintAddress].toString());

        if (!collection || !mint) return;

        const transfer_fee_config = getTransferFeeConfig(mint.mint);
        const input_fee =
            transfer_fee_config === null
                ? 0
                : Number(calculateFee(transfer_fee_config.newerTransferFee, BigInt(collection.swap_price)));

        const swap_price = bignum_to_num(collection.swap_price);
        const input_amount = swap_price - input_fee;

        const swap_fee = Math.floor((input_amount * collection.swap_fee) / 100 / 100);
        const output = input_amount - swap_fee;

        const output_fee =
            transfer_fee_config === null
                ? 0
                : Number(calculateFee(transfer_fee_config.newerTransferFee, BigInt(output)));

        const final_output = output - output_fee;

        setOutAmount(final_output / Math.pow(10, collection.token_decimals));
    }, [collection, mintData, wallet]);

    return outAmount;
};