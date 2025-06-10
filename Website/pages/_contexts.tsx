"use client";

import { useWallet, WalletContextState } from "@solana/wallet-adapter-react";
import { UserData, bignum_to_num, RunGPA, GPAccount } from "../components/Solana/state";
import { Config, PROGRAM, CollectionKeys } from "../components/Solana/constants";
import { CollectionDataUserInput, defaultCollectionInput } from "../components/collection/collectionState";
import { PublicKey, Connection } from "@solana/web3.js";
import { useCallback, useEffect, useState, useRef, PropsWithChildren, SetStateAction, Dispatch } from "react";
import { AppRootContextProvider } from "../context/useAppRoot";
import "bootstrap/dist/css/bootstrap.css";
import { CollectionData } from "@letscook/sdk/dist/state/collections";
import { getTradeMintData } from "../utils/getTokenMintData";

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

async function getTokenPrices(mints: string[], setPriceMap: Dispatch<SetStateAction<Map<string, number>>>): Promise<void> {
    const priceMap = new Map<string, number>();

    // Don't bother doing this is not solana mainnet
    if (!(Config.NETWORK == "mainnet")) {
        mints.forEach((mint) => priceMap.set(mint, 0));
        setPriceMap(priceMap);
        return;
    }

    try {
        // Split mints into chunks of 100 (Jupiter API limit)
        const mintChunks = chunkArray(mints, 100);

        // Process each chunk
        await Promise.all(
            mintChunks.map(async (chunk) => {
                const mintString = chunk.join(",");
                const url = `https://price.jup.ag/v6/price?ids=${mintString}&vsToken=SOL`;

                try {
                    const response = await fetch(url, { method: "GET" });
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const result = await response.json();
                    const resultData = result.data;

                    // Process results for this chunk
                    chunk.forEach((mint) => {
                        const mintData = resultData[mint];
                        priceMap.set(mint, mintData?.price ?? 0);
                    });
                } catch (error) {
                    console.error(`Error fetching prices for chunk:`, error);
                    // Set default values for failed chunk
                    chunk.forEach((mint) => priceMap.set(mint, 0));
                }
            }),
        );

        setPriceMap(priceMap);
    } catch (error) {
        console.error("Error in getTokenPrices:", error);
        // Set default values on error
        mints.forEach((mint) => priceMap.set(mint, 0));
        setPriceMap(priceMap);
    }
}

const GetTradeMintData = async (trade_keys: String[], setMintMap) => {
    let mint_map = await getTradeMintData(trade_keys);
    setMintMap(mint_map);
};

const GetProgramData = async (check_program_data, setProgramData, setIsLaunchDataLoading, setIsHomePageDataLoading) => {
    if (!check_program_data.current) return;

    setIsLaunchDataLoading(true);
    setIsHomePageDataLoading(true);

    let list = await RunGPA();

    //console.log("check program data");
    //console.trace()
    setProgramData(list);

    //console.log(list);

    setIsLaunchDataLoading(false);
    setIsHomePageDataLoading(false);

    check_program_data.current = false;
};

const ContextProviders = ({ children }: PropsWithChildren) => {
    const wallet = useWallet();

    const [selectedNetwork, setSelectedNetwork] = useState(Config.NETWORK);
    const [sidePanelCollapsed, setSidePanelCollapsed] = useState(true);

    const [isLaunchDataLoading, setIsLaunchDataLoading] = useState(false);
    const [isHomePageDataLoading, setIsHomePageDataLoading] = useState(false);

    const [program_data, setProgramData] = useState<GPAccount[] | null>(null);

    const [collection_data, setCollectionData] = useState<Map<string, CollectionData> | null>(null);

    const check_program_data = useRef<boolean>(true);
    const last_program_data_update = useRef<number>(0);

    const program_ws_id = useRef<number | null>(null);

    const newCollectionData = useRef<CollectionDataUserInput>({ ...defaultCollectionInput });

    const check_program_update = useCallback(
        async (new_program_data: any) => {
            if (!new_program_data) return;

            let event_data = Buffer.from(new_program_data.accountInfo.data);

            if (event_data[0] === 8) {
                setCollectionData((currentData) => {
                    console.log("Collection Event Data from context", event_data);

                    const [collection] = CollectionData.struct.deserialize(event_data);
                    console.log("collection update", collection);
                    const newData = new Map(currentData);
                    newData.set(collection.page_name, collection);
                    return newData;
                });
                return;
            }
        },
        [wallet],
    );

    useEffect(() => {
        const connection = new Connection(Config.RPC_NODE, { wsEndpoint: Config.WSS_NODE });

        if (program_ws_id.current === null) {
            program_ws_id.current = connection.onProgramAccountChange(PROGRAM, check_program_update, "confirmed");
        }
    }, [wallet, check_program_update]);

    useEffect(() => {
        if (program_data === null) return;

        let collections: Map<string, CollectionData> = new Map<string, CollectionData>();

        for (let i = 0; i < program_data.length; i++) {
            let data = program_data[i].data;

            if (data[0] === 8) {
                console.log("Collection Data from context", data);

                const [collection] = CollectionData.struct.deserialize(data);
                console.log("deserialized collection from context", collection);

                collections.set(collection.page_name, collection);
                continue;
            }
        }

        setCollectionData(collections);
    }, [program_data, wallet]);

    const ReGetProgramData = useCallback(async () => {
        check_program_data.current = true;
        GetProgramData(check_program_data, setProgramData, setIsLaunchDataLoading, setIsHomePageDataLoading);
    }, []);

    useEffect(() => {
        let current_time = new Date().getTime();
        if (current_time - last_program_data_update.current < 1000) return;

        last_program_data_update.current = current_time;

        GetProgramData(check_program_data, setProgramData, setIsLaunchDataLoading, setIsHomePageDataLoading);
    }, []);

    return (
        <AppRootContextProvider
            sidePanelCollapsed={sidePanelCollapsed}
            setSidePanelCollapsed={setSidePanelCollapsed}
            launchList={null}
            homePageList={null}
            userList={null}
            currentUserData={null}
            joinData={null}
            mmLaunchData={null}
            mmUserData={null}
            isLaunchDataLoading={isLaunchDataLoading}
            isHomePageDataLoading={isHomePageDataLoading}
            checkProgramData={ReGetProgramData}
            newLaunchData={null}
            ammData={null}
            SOLPrice={0}
            mintData={null}
            newCollectionData={newCollectionData}
            collectionList={collection_data}
            setSelectedNetwork={setSelectedNetwork}
            selectedNetwork={selectedNetwork}
            listingData={null}
            setListingData={null}
            setMintData={null}
            jupPrices={null}
        >
            {children}
        </AppRootContextProvider>
    );
};

export default ContextProviders;
