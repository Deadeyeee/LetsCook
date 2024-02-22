"use client";

import { PropsWithChildren, createContext, useContext, MutableRefObject } from "react";
import { TradeHistoryItem } from "@jup-ag/limit-order-sdk";
import { LaunchData, UserData, LaunchDataUserInput, JoinData } from "../components/Solana/state";
import { OpenOrder } from "../components/Solana/jupiter_state";

interface AppRootTypes {
    launchList: LaunchData[];
    homePageList: LaunchData[];
    userList: UserData[];
    currentUserData: UserData;
    isLaunchDataLoading: boolean;
    isUserDataLoading: boolean;
    isHomePageDataLoading: boolean;
    checkLaunchData: () => Promise<void>;
    checkUserData: () => Promise<void>;
    newLaunchData: MutableRefObject<LaunchDataUserInput>;
    joinData: JoinData[];
    checkUserOrders: () => Promise<void>;
    userOrders: OpenOrder[];
    userTrades : TradeHistoryItem[];
}

export const AppRootContext = createContext<AppRootTypes | null>(null);

export const AppRootContextProvider = ({
    children,
    launchList,
    homePageList,
    userList,
    currentUserData,
    isLaunchDataLoading,
    isUserDataLoading,
    isHomePageDataLoading,
    checkLaunchData,
    checkUserData,
    newLaunchData,
    joinData,
    checkUserOrders,
    userOrders,
    userTrades
}: PropsWithChildren<AppRootTypes>) => {
    return (
        <AppRootContext.Provider
            value={{
                launchList,
                homePageList,
                userList,
                currentUserData,
                isLaunchDataLoading,
                isUserDataLoading,
                isHomePageDataLoading,
                checkLaunchData,
                checkUserData,
                newLaunchData,
                joinData,
                checkUserOrders,
                userOrders,
                userTrades
            }}
        >
            {children}
        </AppRootContext.Provider>
    );
};

const useAppRoot = () => {
    const context = useContext(AppRootContext);

    if (!context) {
        throw new Error("No AppRootContext");
    }

    return context;
};

export default useAppRoot;
