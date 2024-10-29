import { HStack, VStack, Text } from "@chakra-ui/react";
import { PropsWithChildren, useState } from "react";
import Navigation from "../components/Navigation";
import { usePathname } from "next/navigation";
import SideNav from "../components/sideNav";

const AppRootPage = ({ children }: PropsWithChildren) => {
    const pathname = usePathname();

    return (
        <VStack h="100vh" className="bg-background-image">
            {<Navigation />}
            <HStack gap={0} h="100%" w="100%" style={{ overflow: "hidden" }}>
                {<SideNav />}
                <VStack
                    pt={{base: 50, md: 100}}
                    h="100%"
                    w="100%"
                    sx={{ flex: 1, overflowY: "auto"}}
                    style={{
                        
                    }}
                    className="bg-background-index"
                >
                    <div style={{ width: "100%", height: "100%", overflowY: "scroll" }}>{children}</div>
                </VStack>
            </HStack>
        </VStack>
    );
};

export default AppRootPage;
