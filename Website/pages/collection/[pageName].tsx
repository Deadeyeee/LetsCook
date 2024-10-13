import {
    VStack,
    Text,
    HStack,
    Progress,
    Button,
    Tooltip,
    Link,
    Flex,
    Card,
    CardBody,
    InputRightElement,
    InputGroup,
    Input,
    Center,
    Divider,
    Spacer,
    useDisclosure,
} from "@chakra-ui/react";
import {
    Key,
    getAssetV1GpaBuilder,
    updateAuthority,
    AssetV1,
    fetchAssetV1,
    deserializeAssetV1,
    collect,
} from "@metaplex-foundation/mpl-core";
import type { RpcAccount, PublicKey as umiKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey } from "@metaplex-foundation/umi";
import { bignum_to_num, TokenAccount, request_token_amount, request_raw_account_data, MintData } from "../../components/Solana/state";
import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { useWallet, useConnection, WalletContextState } from "@solana/wallet-adapter-react";
import { useRouter } from "next/router";
import Image from "next/image";
import useResponsive from "../../hooks/useResponsive";
import UseWalletConnection from "../../hooks/useWallet";
import FeaturedBanner from "../../components/featuredBanner";
import Head from "next/head";
import { MdOutlineContentCopy } from "react-icons/md";
import trimAddress from "../../utils/trimAddress";
import useAppRoot from "../../context/useAppRoot";
import { AssignmentData, CollectionData, request_assignment_data } from "../../components/collection/collectionState";
import PageNotFound from "../../components/pageNotFound";
import Loader from "../../components/loader";
import CollectionFeaturedBanner from "../../components/collectionFeaturedBanner";
import useClaimNFT from "../../hooks/collections/useClaimNFT";
import { CollectionKeys, Config, PROGRAM, Extensions, LaunchFlags, LaunchKeys, SYSTEM_KEY } from "../../components/Solana/constants";
import { PublicKey, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import useWrapNFT from "../../hooks/collections/useWrapNFT";
import useMintNFT from "../../hooks/collections/useMintNFT";
import useMintRandom from "../../hooks/collections/useMintRandom";
import ShowExtensions from "../../components/Solana/extensions";
import { unpackMint, Mint, unpackAccount, getTransferFeeConfig, getAssociatedTokenAddressSync, calculateFee } from "@solana/spl-token";
import { getSolscanLink } from "../../utils/getSolscanLink";
import { LuArrowUpDown } from "react-icons/lu";
import { FaWallet } from "react-icons/fa";
import { ReceivedAssetModal, ReceivedAssetModalStyle } from "../../components/Solana/modals";
import { findCollection } from "../../components/collection/utils";
import BN from "bn.js";
import formatPrice from "../../utils/formatPrice";
import useTokenBalance from "../../hooks/data/useTokenBalance";
import useCollection from "../../hooks/data/useCollection";
import { useNftBalance } from "../../hooks/data/useNftBalance";
import { useWhitelist } from "../../hooks/useWhitelist";
import { useOutputCalculation } from "../../hooks/data/useOutAmmount";
import useAssignmentData from "../../hooks/data/useAssignmentData";

export interface AssetWithMetadata {
    asset: AssetV1;
    metadata: any;
}

export const check_nft_balance = async (launch_key: PublicKey, wallet: WalletContextState, setOwnedAssets: any, setNFTBalance: any) => {
    if (launch_key === null || wallet === null || wallet.publicKey === null) return;

    //console.log("CHECKING NFT BALANCE");

    const umi = createUmi(Config.RPC_NODE, "confirmed");

    let collection_umiKey = publicKey(launch_key.toString());

    const assets = await getAssetV1GpaBuilder(umi)
        .whereField("key", Key.AssetV1)
        .whereField("updateAuthority", updateAuthority("Collection", [collection_umiKey]))
        .getDeserialized();

    //console.log(assets);
    let valid_lookups = 0;
    let owned_assets: AssetWithMetadata[] = [];
    for (let i = 0; i < assets.length; i++) {
        if (assets[i].owner.toString() === wallet.publicKey.toString()) {
            valid_lookups += 1;
            let uri_json = await fetch(assets[i].uri).then((res) => res.json());
            let entry: AssetWithMetadata = { asset: assets[i], metadata: uri_json };
            owned_assets.push(entry);
        }
    }
    //console.log("have ", valid_lookups, "addresses with balance");

    setOwnedAssets(owned_assets);
    setNFTBalance(valid_lookups);
};

const CollectionSwapPage = () => {
    const wallet = useWallet();
    const { connection } = useConnection();
    const router = useRouter();
    const { pageName } = router.query;
    const { xs, sm, md, lg, xl } = useResponsive();
    const { handleConnectWallet } = UseWalletConnection();
    const { mintData } = useAppRoot();
    const [token_amount, setTokenAmount] = useState<number>(0);
    const [nft_amount, setNFTAmount] = useState<number>(0);
    const [isTokenToNFT, setIsTokenToNFT] = useState(false);

    const collection_key = useRef<PublicKey | null>(null);
    const nft_account_ws_id = useRef<number | null>(null);
    const mint_nft = useRef<boolean>(false);
    const check_initial_nft_balance = useRef<boolean>(true);


    const [white_list, setWhiteList] = useState<MintData | null>(null);

    const { isOpen: isAssetModalOpen, onOpen: openAssetModal, onClose: closeAssetModal } = useDisclosure();

    const { collection, collectionPlugins, error: collectionError } = useCollection({ pageName: pageName as string | null });
    const whitelist = useWhitelist(collectionPlugins, mintData);
    const getOutputAmount = useOutputCalculation(collection);

    const { ClaimNFT, isLoading: isClaimLoading, OraoRandoms, setOraoRandoms } = useClaimNFT(collection);

    const { MintNFT, isLoading: isMintLoading } = useMintNFT(collection);
    const { WrapNFT, isLoading: isWrapLoading } = useWrapNFT(collection);
    const { MintRandom, isLoading: isMintRandomLoading } = useMintRandom(collection);
    const mintAddress = useMemo(() => {
        return collection?.keys?.[CollectionKeys.MintAddress] || null;
    }, [collection]);

    const { tokenBalance } = useTokenBalance(mintAddress ? { mintAddress } : null);

    let isLoading = isClaimLoading || isMintRandomLoading || isWrapLoading || isMintLoading;

    const { ownedAssets, nftBalance, loading, error, refetch } = useNftBalance(collection_key.current, wallet);
    const { assignedNFT, setAssignedNFT,  setOraoRandoms: assignmentSetOraoRandoms, mintNft, asset_image, asset_received } = useAssignmentData(
        wallet,
        collection,
        connection,
        setOraoRandoms,
        openAssetModal,
        refetch,
    );
    const modalStyle: ReceivedAssetModalStyle = {
        check_image: "/images/cooks.jpeg",
        failed_image: "/images/cooks.jpeg",
        fontFamily: "KGSummerSunshineBlackout",
        fontColor: "white",
        succsss_h: 620,
        failed_h: 620,
        checking_h: 620,
        success_w: 620,
        failed_w: 620,
        checking_w: 620,
        sm_succsss_h: 570,
        sm_success_w: 420,
        sm_failed_h: 350,
        sm_failed_w: 350,
        sm_checking_h: 570,
        sm_checking_w: 420,
    };

    useEffect(() => {
        if (!isLoading) {
            refetch(); // Call refetch only after WrapNFT is finished
            console.log("WrapNFT finished, refetching...");
        }
    }, [isLoading, refetch]);

    useEffect(() => {
        if (!collection || !mintData) return;

        collection_key.current = collection.keys[CollectionKeys.CollectionMint];

        if (collectionPlugins.whitelistKey) {
            setWhiteList(mintData.get(collectionPlugins.whitelistKey.toString()));
            console.log("white_listwhite_list", white_list);
        }

        if (collectionPlugins.mintOnly) {
            setIsTokenToNFT(true);
        }
    }, [collection, collectionPlugins, mintData, wallet]);

    // when page unloads unsub from any active websocket listeners

    useEffect(() => {
        return () => {
            const unsub = async () => {
                if (nft_account_ws_id.current !== null) {
                    await connection.removeAccountChangeListener(nft_account_ws_id.current);
                    nft_account_ws_id.current = null;
                }
            };
            unsub();
        };
    }, [connection]);

    useEffect(() => {
        if (!mint_nft.current) return;

        if (OraoRandoms.length === 0) return;

        mint_nft.current = false;
    }, [OraoRandoms]);
    
    useEffect(() => {
        if (!collection) return;

        if (wallet === null || wallet.publicKey === null) {
            return;
        }
    }, [wallet, connection, collection]);

    useEffect(() => {
        if (collection === null) return;

        if (wallet === null || wallet.publicKey === null) {
            return;
        }


        if (collection_key.current && check_initial_nft_balance.current) {
            refetch();
            check_initial_nft_balance.current = false;
        }
    }, [collection, wallet, refetch]);

    if (!pageName) return;

    if (collection === null) return <Loader />;

    if (!collection) return <PageNotFound />;

    const enoughTokenBalance = tokenBalance >= bignum_to_num(collection.swap_price) / Math.pow(10, collection.token_decimals);

    let progress_string = "";
    if (collection.collection_meta["__kind"] === "RandomFixedSupply") {
        progress_string = collection.num_available.toString() + " / " + collection.total_supply.toString();
    }
    if (collection.collection_meta["__kind"] === "RandomUnlimited") {
        progress_string = "Unlimited";
    }

    return (
        <>
            <Head>
                <title>Let&apos;s Cook | {pageName}</title>
            </Head>
            <main style={{ background: "linear-gradient(180deg, #292929 10%, #0B0B0B 100%)" }}>
                <CollectionFeaturedBanner featuredLaunch={collection} isHomePage={false} />
                <div style={{ padding: "16px" }}>
                    <VStack
                        p={md ? 22 : 50}
                        bg="rgba(225, 225, 225, 0.20)"
                        borderRadius={12}
                        border="1px solid white"
                        h="fit-content"
                        justifyContent="space-between"
                    >
                        <Flex gap={lg ? 12 : 24} direction={lg ? "column" : "row"} alignItems={"center"}>
                            <VStack minW={220}>
                                <Image
                                    src={collection.collection_icon_url}
                                    width={180}
                                    height={180}
                                    alt="Image Frame"
                                    style={{ backgroundSize: "cover", borderRadius: 12 }}
                                />
                                <Text mt={1} mb={0} color="white" fontSize="x-large" fontFamily="ReemKufiRegular">
                                    {collection.collection_name}
                                </Text>
                                <HStack spacing={2} align="start" justify="start">
                                    <Text m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"large"}>
                                        CA: {trimAddress(collection.keys[CollectionKeys.CollectionMint].toString())}
                                    </Text>

                                    <Tooltip label="Copy Contract Address" hasArrow fontSize="large" offset={[0, 10]}>
                                        <div
                                            style={{ cursor: "pointer" }}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                navigator.clipboard.writeText(
                                                    collection && collection.keys && collection.keys[CollectionKeys.CollectionMint]
                                                        ? collection.keys[CollectionKeys.CollectionMint].toString()
                                                        : "",
                                                );
                                            }}
                                        >
                                            <MdOutlineContentCopy color="white" size={lg ? 22 : 22} />
                                        </div>
                                    </Tooltip>

                                    <Tooltip label="View in explorer" hasArrow fontSize="large" offset={[0, 10]}>
                                        <Link
                                            href={getSolscanLink(collection.keys[CollectionKeys.CollectionMint], "Collection")}
                                            target="_blank"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Image
                                                src="/images/solscan.png"
                                                width={lg ? 22 : 22}
                                                height={lg ? 22 : 22}
                                                alt="Solscan icon"
                                            />
                                        </Link>
                                    </Tooltip>
                                </HStack>
                                <ShowExtensions extension_flag={collection.flags[LaunchFlags.Extensions]} />
                            </VStack>

                            <VStack pb={white_list && 6}>
                                {white_list &&
                                    collectionPlugins.whitelistPhaseEnd &&
                                    (collectionPlugins.whitelistPhaseEnd.getTime() === 0 ||
                                        new Date().getTime() < collectionPlugins.whitelistPhaseEnd.getTime()) && (
                                        <VStack my={3}>
                                            <Text align="center" m={0} color={"white"} fontFamily="ReemKufiRegular">
                                                Whitelist Token Required: <br />{" "}
                                            </Text>
                                            <HStack justifyContent="center">
                                                <Text color={"white"} fontFamily="ReemKufiRegular" mb={0}>
                                                    CA: {trimAddress(white_list.mint.address.toString())}
                                                </Text>
                                                <Tooltip label="View in explorer" hasArrow fontSize="large" offset={[0, 10]}>
                                                    <Link
                                                        href={getSolscanLink(white_list.mint.address, "Token")}
                                                        target="_blank"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Image
                                                            src="/images/solscan.png"
                                                            width={lg ? 22 : 22}
                                                            height={lg ? 22 : 22}
                                                            alt="Solscan icon"
                                                        />
                                                    </Link>
                                                </Tooltip>
                                            </HStack>
                                            {collectionPlugins.whitelistPhaseEnd &&
                                                Math.floor(collectionPlugins.whitelistPhaseEnd.getTime() / 1000) > 0 &&
                                                new Date().getTime() < collectionPlugins.whitelistPhaseEnd.getTime() && (
                                                    <Text align="center" mb={0} opacity="50%">
                                                        Until: {collectionPlugins.whitelistPhaseEnd.toLocaleString()}
                                                    </Text>
                                                )}
                                        </VStack>
                                    )}
                                <VStack
                                    my="auto"
                                    h="100%"
                                    borderRadius={12}
                                    p={4}
                                    align="center"
                                    w={350}
                                    style={{ background: "rgba(0, 0, 0, 0.2)" }}
                                    boxShadow="0px 5px 15px 0px rgba(0,0,0,0.3)"
                                    gap={0}
                                >
                                    <Text align={sm ? "center" : "start"} className="font-face-kg" color={"white"} fontSize="x-large">
                                        Collection Wrap
                                    </Text>

                                    <HStack align="center" mb={4}>
                                        <Text m={0} color="white" fontSize="medium" fontWeight="semibold">
                                            {!isTokenToNFT
                                                ? `1 NFT = ${formatPrice(getOutputAmount, 3)} ${collection.token_symbol}`
                                                : `${formatPrice(
                                                      bignum_to_num(collection.swap_price) / Math.pow(10, collection.token_decimals),
                                                      3,
                                                  )} ${collection.token_symbol} = 1 NFT`}
                                        </Text>
                                        <Tooltip label="With 2% Transfer Tax" hasArrow fontSize="medium" offset={[0, 10]}>
                                            <Image width={20} height={20} src="/images/help.png" alt="Help" />
                                        </Tooltip>
                                    </HStack>

                                    <Flex w="100%" align="center" gap={3} flexDirection={isTokenToNFT ? "column" : "column-reverse"}>
                                        <VStack w="100%">
                                            <HStack w="100%" justifyContent="space-between">
                                                <Text m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"medium"} opacity={0.5}>
                                                    {isTokenToNFT ? "You're Paying" : "To Receive"}
                                                </Text>

                                                <HStack gap={1} opacity={0.5}>
                                                    <FaWallet size={12} color="white" />
                                                    <Text pl={0.5} m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"medium"}>
                                                        {tokenBalance.toLocaleString()}
                                                    </Text>
                                                    <Text m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"medium"}>
                                                        {collection.token_symbol}
                                                    </Text>
                                                </HStack>
                                            </HStack>
                                            <InputGroup size="md">
                                                <Input
                                                    color="white"
                                                    size="lg"
                                                    borderColor="rgba(134, 142, 150, 0.5)"
                                                    value={
                                                        isTokenToNFT
                                                            ? formatPrice(
                                                                  bignum_to_num(collection.swap_price) /
                                                                      Math.pow(10, collection.token_decimals),
                                                                  3,
                                                              )
                                                            : formatPrice(getOutputAmount, 3)
                                                    }
                                                    onChange={(e) => {
                                                        setTokenAmount(
                                                            !isNaN(parseFloat(e.target.value)) || e.target.value === ""
                                                                ? parseFloat(e.target.value)
                                                                : token_amount,
                                                        );
                                                    }}
                                                    disabled={true}
                                                    type="number"
                                                    min="0"
                                                />
                                                <InputRightElement h="100%" w={50}>
                                                    <Image
                                                        src={collection.token_icon_url}
                                                        width={30}
                                                        height={30}
                                                        alt="SOL Icon"
                                                        style={{ borderRadius: "100%" }}
                                                    />
                                                </InputRightElement>
                                            </InputGroup>
                                        </VStack>

                                        {!collectionPlugins.mintOnly && (
                                            <LuArrowUpDown
                                                size={24}
                                                color="white"
                                                style={{ marginTop: "12px", cursor: "pointer" }}
                                                onClick={() => setIsTokenToNFT(!isTokenToNFT)}
                                            />
                                        )}

                                        <VStack w="100%">
                                            <HStack w="100%" justifyContent="space-between">
                                                <Text m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"medium"} opacity={0.5}>
                                                    {isTokenToNFT ? "To Receivse" : "You're Paying"}
                                                </Text>

                                                <HStack gap={1} opacity={0.5}>
                                                    <FaWallet size={12} color="white" />
                                                    <Text pl={0.5} m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"medium"}>
                                                        {nftBalance}
                                                    </Text>
                                                    <Text m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"medium"}>
                                                        {collection.collection_symbol}
                                                    </Text>
                                                </HStack>
                                            </HStack>
                                            <InputGroup size="md">
                                                <Input
                                                    color="white"
                                                    size="lg"
                                                    borderColor="rgba(134, 142, 150, 0.5)"
                                                    value={1}
                                                    onChange={(e) => {
                                                        setNFTAmount(
                                                            !isNaN(parseFloat(e.target.value)) || e.target.value === ""
                                                                ? parseFloat(e.target.value)
                                                                : nft_amount,
                                                        );
                                                    }}
                                                    disabled={true}
                                                    type="number"
                                                    min="0"
                                                />
                                                <InputRightElement h="100%" w={50}>
                                                    <Image
                                                        src={collection.collection_icon_url}
                                                        width={30}
                                                        height={30}
                                                        alt="SOL Icon"
                                                        style={{ borderRadius: "100%" }}
                                                    />
                                                </InputRightElement>
                                            </InputGroup>
                                        </VStack>
                                    </Flex>

                                    {wallet.connected ? (
                                        <VStack spacing={3} w="100%">
                                            {isTokenToNFT ? (
                                                <HStack w="100%">
                                                    {assignedNFT === null || assignedNFT.status > 0 ? (
                                                        <Tooltip
                                                            label="You don't have enough token balance"
                                                            hasArrow
                                                            offset={[0, 10]}
                                                            isDisabled={enoughTokenBalance}
                                                        >
                                                            <Button
                                                                w="100%"
                                                                mt={3}
                                                                onClick={() => {
                                                                    if (!wallet.connected) {
                                                                        handleConnectWallet();
                                                                    }

                                                                    if (wallet.connected && enoughTokenBalance) {
                                                                        ClaimNFT();
                                                                    }
                                                                }}
                                                                isLoading={isLoading}
                                                                isDisabled={!enoughTokenBalance || isLoading}
                                                            >
                                                                Confirm {collectionPlugins.probability}
                                                            </Button>
                                                        </Tooltip>
                                                    ) : (
                                                        <Button
                                                            w="100%"
                                                            mt={3}
                                                            onClick={() => {
                                                                if (collection.collection_meta["__kind"] === "RandomFixedSupply") {
                                                                    openAssetModal();
                                                                    MintNFT();
                                                                }
                                                                if (collection.collection_meta["__kind"] === "RandomUnlimited") {
                                                                    openAssetModal();
                                                                    MintRandom();
                                                                }
                                                            }}
                                                            isLoading={isLoading}
                                                        >
                                                            Confirm {collectionPlugins.probability}
                                                        </Button>
                                                    )}
                                                </HStack>
                                            ) : (
                                                <Tooltip
                                                    label={`You don't have ${collection.collection_name} NFTs`}
                                                    hasArrow
                                                    offset={[0, 10]}
                                                    isDisabled={nftBalance > 0 || isLoading}
                                                >
                                                    <Button
                                                        w="100%"
                                                        mt={3}
                                                        onClick={() => {
                                                            if (wallet.connected) {
                                                                WrapNFT(null);
                                                            } else {
                                                                handleConnectWallet();
                                                            }
                                                        }}
                                                        isLoading={isWrapLoading}
                                                        isDisabled={nftBalance <= 0 || isLoading}
                                                    >
                                                        Confirm
                                                    </Button>
                                                </Tooltip>
                                            )}
                                        </VStack>
                                    ) : (
                                        <Button w="100%" mt={3} onClick={() => handleConnectWallet()}>
                                            Connect your wallet
                                        </Button>
                                    )}
                                </VStack>
                            </VStack>

                            <VStack minW={220}>
                                <Image
                                    src={collection.token_icon_url}
                                    width={180}
                                    height={180}
                                    alt="Image Frame"
                                    style={{ backgroundSize: "cover", borderRadius: 12 }}
                                />
                                <Text mt={1} mb={0} color="white" fontSize="x-large" fontFamily="ReemKufiRegular">
                                    {collection.token_symbol}
                                </Text>
                                <HStack mb={1} spacing={2} align="start" justify="start">
                                    <Text m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"large"}>
                                        CA: {trimAddress(collection.keys[CollectionKeys.MintAddress].toString())}
                                    </Text>

                                    <Tooltip label="Copy Contract Address" hasArrow fontSize="large" offset={[0, 10]}>
                                        <div
                                            style={{ cursor: "pointer" }}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                navigator.clipboard.writeText(collection.keys[CollectionKeys.MintAddress].toString());
                                            }}
                                        >
                                            <MdOutlineContentCopy color="white" size={lg ? 22 : 22} />
                                        </div>
                                    </Tooltip>

                                    <Tooltip label="View in explorer" hasArrow fontSize="large" offset={[0, 10]}>
                                        <Link
                                            href={getSolscanLink(collection.keys[CollectionKeys.MintAddress], "Token")}
                                            target="_blank"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Image
                                                src="/images/solscan.png"
                                                width={lg ? 22 : 22}
                                                height={lg ? 22 : 22}
                                                alt="Solscan icon"
                                            />
                                        </Link>
                                    </Tooltip>

                                    <Tooltip label="Rug Check" hasArrow fontSize="large" offset={[0, 10]}>
                                        <Link
                                            href={`https://rugcheck.xyz/tokens/${
                                                collection && collection.keys && collection.keys[CollectionKeys.MintAddress]
                                                    ? collection.keys[CollectionKeys.MintAddress].toString()
                                                    : ""
                                            }`}
                                            target="_blank"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Image
                                                src="/images/rugcheck.jpeg"
                                                width={22}
                                                height={22}
                                                alt="Rugcheck icon"
                                                style={{ borderRadius: "100%" }}
                                            />
                                        </Link>
                                    </Tooltip>
                                </HStack>
                                <ShowExtensions extension_flag={collection.token_extensions} />
                            </VStack>
                        </Flex>

                        <VStack mt={5} spacing={0} w="100%" style={{ position: "relative" }}>
                            <Text color="white" fontSize="x-large" fontFamily="ReemKufiRegular">
                                Available Supply
                            </Text>
                            <HStack w="100%" style={{ position: "relative", alignItems: "center", justifyContent: "center" }}>
                                <Progress
                                    w="100%"
                                    h={29}
                                    borderRadius={20}
                                    sx={{
                                        "& > div": {
                                            background: "linear-gradient(180deg, #8DFE7A 0%, #3E9714 100%)",
                                        },
                                    }}
                                    size="sm"
                                    min={0}
                                    max={collection.total_supply}
                                    value={collection.num_available}
                                    boxShadow="0px 5px 15px 0px rgba(0,0,0,0.6) inset"
                                />
                                <HStack style={{ position: "absolute", zIndex: 1 }}>
                                    <HStack justify="center">
                                        <Text m="0" color="black" fontSize={sm ? "medium" : "large"} fontFamily="ReemKufiRegular">
                                            {progress_string}
                                        </Text>
                                    </HStack>
                                </HStack>
                            </HStack>
                        </VStack>
                    </VStack>
                </div>
                <ReceivedAssetModal
                    curated={false}
                    have_randoms={OraoRandoms.length > 0}
                    isWarningOpened={isAssetModalOpen}
                    closeWarning={closeAssetModal}
                    assignment_data={assignedNFT}
                    collection={collection}
                    asset={asset_received}
                    asset_image={asset_image}
                    style={modalStyle}
                    isLoading={isLoading}
                />
            </main>
        </>
    );
};

export default CollectionSwapPage;
