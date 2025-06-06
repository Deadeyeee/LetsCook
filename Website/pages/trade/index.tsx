import { Text, Box, HStack, Flex, AbsoluteCenter } from "@chakra-ui/react";
import { useState } from "react";
import useResponsive from "../../hooks/useResponsive";
import Head from "next/head";
import MarketMakingTable from "../../components/tables/marketMakingTable";
import useAppRoot from "../../context/useAppRoot";
import MyRewardsTable from "../../components/tables/myRewards";
import { useWallet } from "@solana/wallet-adapter-react";
import { absoluteAmount } from "@metaplex-foundation/umi";

const MarketMaker = () => {
    const { xs, sm, lg } = useResponsive();
    const wallet = useWallet();
    const [selected, setSelected] = useState("Markets");
    const [selectedSubTab, setSelectedSubTab] = useState("Open");
    const { launchList } = useAppRoot();

    // TEMPORARILY DISABLED FOR PERFORMANCE
    return (
        <>
            <Head>
                <title>Let&apos;s Cook | Trade</title>
            </Head>
            <main className="md:p-8">
                <div className="mb-4 flex flex-col gap-4 lg:gap-0" style={{ marginTop: sm ? 16 : 0 }}>
                    <Text className="block text-center text-3xl font-semibold text-white lg:text-4xl" align={"center"}>
                        Trade
                    </Text>
                    <Text className="mt-4 block text-center text-lg text-white/70" align={"center"}>
                        This page is temporarily disabled for performance optimization.
                    </Text>
                    <Text className="block text-center text-lg text-white/70" align={"center"}>
                        You can still create new tokens via the &quot;New Token&quot; page.
                    </Text>
                </div>
            </main>
        </>
    );

    // ORIGINAL CODE - DISABLED FOR PERFORMANCE
    /*
    const handleClick = (tab: string) => {
        setSelected(tab);
    };

    const handleSubTabClick = (tab: string) => {
        setSelectedSubTab(tab);
    };

    return (
        <>
            <Head>
                <title>Let&apos;s Cook | Trade</title>
            </Head>
            <main className="md:p-8">
                <Flex
                    gap={4}
                    justifyContent={!sm ? "space-between" : "end"}
                    style={{ position: "relative", flexDirection: sm ? "column" : "row" }}
                    className="mb-2 w-full px-2"
                >
                    <Text
                        className="mt-3 block text-center text-3xl font-semibold text-white md:hidden lg:text-4xl"
                        style={{ position: sm ? "static" : "absolute", left: 0, bottom: 5, right: 0, margin: "auto" }}
                        align={"center"}
                    >
                        {selected === "Markets" ? "Markets" : selected === "Rewards" ? "Rewards" : "My Orders"}
                    </Text>

                    <Text
                        className="mt-4 hidden text-center text-3xl font-semibold text-white lg:block lg:text-4xl"
                        style={{ position: sm ? "static" : "absolute", left: 0, bottom: 5, right: 0, margin: "auto" }}
                        align={"center"}
                    >
                        {selected === "Markets" ? "Markets" : selected === "Rewards" ? "Rewards" : "My Orders"}
                    </Text>

                    <HStack align="center" spacing={0} zIndex={99} w="100%" mt={xs ? 1 : -2}>
                        {["Markets", "Rewards"].map((name, i) => {
                            const isActive = selected === name;

                            const baseStyle = {
                                display: "flex",
                                alignItems: "center",
                                cursor: "pointer",
                            };

                            const activeStyle = {
                                color: "white",
                                borderBottom: isActive ? "2px solid white" : "",
                                opacity: isActive ? 1 : 0.5,
                            };

                            const mobileBaseStyle = {
                                display: "flex",
                                alignItems: "center",
                                cursor: "pointer",
                            };

                            const mobileActiveStyle = {
                                background: isActive ? "#edf2f7" : "transparent",
                                color: isActive ? "black" : "white",
                                borderRadius: isActive ? "6px" : "",
                                border: isActive ? "none" : "",
                            };

                            const base = sm ? mobileBaseStyle : baseStyle;
                            const active = sm ? mobileActiveStyle : activeStyle;

                            return (
                                <Box
                                    key={i}
                                    style={{
                                        ...base,
                                        ...active,
                                    }}
                                    onClick={() => {
                                        handleClick(name);
                                    }}
                                    px={4}
                                    py={2}
                                    w={sm ? "50%" : "fit-content"}
                                >
                                    <Text m={"0 auto"} fontSize="large" fontWeight="semibold">
                                        {name}
                                    </Text>
                                </Box>
                            );
                        })}
                    </HStack>

                    {selected === "Orders" && (
                        <HStack spacing={3}>
                            {["Open", "Filled"].map((name, i) => {
                                const isActive = selectedSubTab === name;

                                const baseStyle = {
                                    display: "flex",
                                    alignItems: "center",
                                    cursor: "pointer",
                                };

                                const activeStyle = {
                                    color: "white",
                                    borderBottom: isActive ? "2px solid white" : "",
                                    opacity: isActive ? 1 : 0.5,
                                };

                                return (
                                    <HStack
                                        key={i}
                                        style={{
                                            ...baseStyle,
                                            ...activeStyle,
                                        }}
                                        onClick={() => {
                                            handleSubTabClick(name);
                                        }}
                                        px={4}
                                        py={2}
                                        mt={-2}
                                        w={"fit-content"}
                                        justify="center"
                                    >
                                        <Text m={"0 auto"} fontSize="medium" fontWeight="semibold">
                                            {name}
                                        </Text>
                                    </HStack>
                                );
                            })}
                        </HStack>
                    )}
                </Flex>

                {selected === "Markets" && (
                    <div className="lg:-mt-3">
                        <MarketMakingTable />
                    </div>
                )}

                {!wallet.connected && selected === "Orders" && (
                    <HStack w="100%" align="center" justify="center" mt={25}>
                        <Text fontSize={lg ? "large" : "x-large"} m={0} color={"white"} style={{ cursor: "pointer" }}>
                            Connect your wallet to see your orders
                        </Text>
                    </HStack>
                )}

                {selected === "Rewards" && (
                    <div className="-mt-3">
                        <MyRewardsTable amm={null} />
                    </div>
                )}

                {!wallet.connected && selected === "Rewards" && (
                    <HStack w="100%" align="center" justify="center" mt={25}>
                        <Text fontSize={lg ? "large" : "x-large"} m={0} color={"white"} style={{ cursor: "pointer" }}>
                            Connect your wallet to see your rewards
                        </Text>
                    </HStack>
                )}
            </main>
        </>
    );
    */
};

export default MarketMaker;
