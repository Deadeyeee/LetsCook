import { Dispatch, SetStateAction, useState } from "react";
import { HStack, Text, Box, Stack, Button, VStack, useDisclosure } from "@chakra-ui/react";
import { ConnectWalletButton, DisconnectWalletButton } from "./Solana/wallet";
import { useWallet } from "@solana/wallet-adapter-react";
import { Screen } from "./Solana/constants";
import styles from "./header.module.css";
import useResponsive from "../hooks/useResponsive";
import Image from "next/image";
import UseWalletConnection from "../hooks/useWallet";
import MainButton from "./Buttons/mainButton";
import Link from "next/link";

function Navigation({ setScreen }: { setScreen?: Dispatch<SetStateAction<Screen>> }) {
    const wallet = useWallet();
    const { md } = useResponsive();
    const { isOpen, onToggle } = useDisclosure();
    const { handleDisconnectWallet, handleConnectWallet } = UseWalletConnection();

    return (
        <>
            <div className={styles.headerImage}>
                <HStack
                    boxShadow="0px 3px 13px 0px rgba(0, 0, 0, 0.75)"
                    px={4}
                    h="100%"
                    w="100%"
                    alignItems="center"
                    justify="space-between"
                >
                    <Link href="/">
                        <Text
                            fontSize={md ? "large" : "x-large"}
                            color={"#683309"}
                            className="font-face-kg"
                            style={{ cursor: "pointer", margin: "auto 0" }}
                        >
                            LET'S COOK
                        </Text>
                    </Link>
                    <HStack gap={4}>
                        <div className={styles.sauce}>
                            <Image height={20} width={20} src="/images/sauce 2.png" alt="Sauce" />
                            <div>1,400</div>
                        </div>

                        {!md && (
                            <Link href="/leaderboard">
                                <Image src="/images/points.png" width={35} height={35} alt={"Points"} />
                            </Link>
                        )}

                        {!md && (
                            <Image src="/images/money-bag.png" width={35} height={35} alt={"Money Bag"} style={{ cursor: "not-allowed" }} />
                        )}

                        {!md && (
                            <Link href="/faq">
                                <Image src="/images/question-mark.png" width={35} height={35} alt={"Question Mark"} />
                            </Link>
                        )}

                        {md ? (
                            <Image
                                onClick={onToggle}
                                src="/images/Group (6).png"
                                width={40}
                                height={40}
                                alt={"Burger Icon"}
                                style={{ marginRight: 5 }}
                            />
                        ) : (
                            <>
                                {wallet.publicKey && <DisconnectWalletButton />}
                                {wallet.publicKey === null && <ConnectWalletButton />}

                                <Link href="/launch">
                                    <MainButton label="LAUNCH" />
                                </Link>
                            </>
                        )}
                    </HStack>
                </HStack>
            </div>

            {/* Mobile Menu */}
            <VStack
                position="absolute"
                top={50}
                justify="center"
                left={0}
                right={0}
                py={10}
                pb={6}
                bg="url(/images/mobile-menu-bg.png)"
                backgroundSize="cover"
                borderBottomRadius={12}
                spacing={6}
                hidden={!md || !isOpen}
                boxShadow="0px 3px 13px 0px rgba(0,0,0,0.75) inset"
            >
                <VStack spacing={3} mb={6} className="font-face-kg">
                    {wallet.publicKey && (
                        <Text fontSize="x-large" color="#683309" className="font-face-kg" onClick={() => handleDisconnectWallet()}>
                            Disconnect Wallet
                        </Text>
                    )}
                    {wallet.publicKey === null && (
                        <Text fontSize="x-large" color="#683309" className="font-face-kg" onClick={() => handleConnectWallet()}>
                            Connect Wallet
                        </Text>
                    )}
                    <Image src="/images/divider.png" alt="Divider" width="320" height={20} />
                </VStack>

                <Link href="/launch" onClick={onToggle}>
                    <Text className={styles.connect}>LAUNCH</Text>
                </Link>

                <Link href="/leaderboard" onClick={onToggle}>
                    <Text className={styles.connect}>LEADERBOARD</Text>
                </Link>

                <Text className={styles.connect} style={{ opacity: 0.5 }}>
                    MY BAGS
                </Text>

                <Text className={styles.connect} style={{ opacity: 0.5 }}>
                    HISTORY
                </Text>

                <Link href="/faq" onClick={onToggle}>
                    <Text className={styles.connect}>FAQS</Text>
                </Link>
            </VStack>
        </>
    );
}

export default Navigation;