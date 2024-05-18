import { PublicKey, Keypair, LAMPORTS_PER_SOL, AccountInfo } from "@solana/web3.js";
import {
    FixableBeetStruct,
    BeetStruct,
    uniformFixedSizeArray,
    u8,
    u16,
    u32,
    u64,
    i64,
    bignum,
    utf8String,
    array,
    coption,
    COption,
    DataEnumKeyAsKind,
    dataEnum,
    FixableBeetArgsStruct,
    BeetArgsStruct,
    FixableBeet,
} from "@metaplex-foundation/beet";
import { publicKey } from "@metaplex-foundation/beet-solana";
import { Wallet, WalletContextState, useWallet } from "@solana/wallet-adapter-react";

import { DEBUG, Config, PROGRAM, LaunchKeys, Socials, Extensions } from "./constants";
import { Box } from "@chakra-ui/react";

import BN from "bn.js";
import bs58 from "bs58";

import { WalletDisconnectButton } from "@solana/wallet-adapter-react-ui";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, Mint } from "@solana/spl-token";

export async function get_JWT_token(): Promise<any | null> {
    const token_url = `/.netlify/functions/jwt`;

    var token_result;
    try {
        token_result = await fetch(token_url).then((res) => res.json());
    } catch (error) {
        console.log(error);
        return null;
    }

    if (DEBUG) console.log(token_result);

    return token_result;
}

export function WalletConnected() {
    return (
        <Box>
            <WalletDisconnectButton className="wallet-disconnect-button" />
        </Box>
    );
}

// Example POST method implementation:
export async function postData(url = "", bearer = "", data = {}) {
    //console.log("in post data", data)
    // Default options are marked with *
    const response = await fetch(url, {
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data), // body data type must match "Content-Type" header
    });
    return response.json(); // parses JSON response into native JavaScript objects
}

export function uInt8ToLEBytes(num: number): Buffer {
    const bytes = Buffer.alloc(1);
    bytes.writeUInt8(num);

    return bytes;
}

export function uInt16ToLEBytes(num: number): Buffer {
    const bytes = Buffer.alloc(2);
    bytes.writeUInt16LE(num);

    return bytes;
}

export function uInt32ToLEBytes(num: number): Buffer {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32LE(num);

    return bytes;
}

interface BasicReply {
    id: number;
    jsonrpc: string;
    result: string;
    error: string;
}

export function check_json(json_response: BasicReply): boolean {
    if (json_response.result === undefined) {
        if (json_response.error !== undefined) {
            console.log(json_response.error);
        }
        return false;
    }

    if (json_response.result === null) return false;

    return true;
}

////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////// Transactions ///////////////////////// /////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

interface BlockHash {
    blockhash: string;
    lastValidBlockHeight: number;
}

export async function get_current_blockhash(bearer: string): Promise<BlockHash> {
    var body = { id: 1, jsonrpc: "2.0", method: "getLatestBlockhash" };
    const blockhash_data_result = await postData(Config.RPC_NODE, bearer, body);

    console.log(Config.RPC_NODE);
    let blockhash = blockhash_data_result["result"]["value"]["blockhash"];
    let last_valid = blockhash_data_result["result"]["value"]["lastValidBlockHeight"];

    let hash_data: BlockHash = { blockhash: blockhash, lastValidBlockHeight: last_valid };

    return hash_data;
}

interface TransactionResponseData {
    id: number;
    jsonrpc: string;
    result: string;
}

export async function send_transaction(bearer: string, encoded_transaction: string): Promise<TransactionResponseData> {
    var body = { id: 1, jsonrpc: "2.0", method: "sendTransaction", params: [encoded_transaction, { skipPreflight: true }] };

    var response_json = await postData(Config.RPC_NODE, bearer, body);
    let transaction_response: TransactionResponseData = response_json;

    let valid_json = check_json(response_json);

    if (valid_json) return transaction_response;

    transaction_response.result = "INVALID";
    return transaction_response;
}

interface SignatureResponseData {
    id: number;
    jsonrpc: string;
    result: {
        context: {
            apiVersion: string;
            slot: number;
        };
        value: [
            {
                confirmationStatus: string;
                confirmations: number;
                err: string | null;
                slot: number;
            },
        ];
    } | null;
}

export async function check_signature(bearer: string, signature: string): Promise<SignatureResponseData | null> {
    var body = { id: 1, jsonrpc: "2.0", method: "getSignatureStatuses", params: [[signature], { searchTransactionHistory: true }] };

    var response_json = await postData(Config.RPC_NODE, bearer, body);
    let transaction_response: SignatureResponseData = response_json;

    let valid_json = check_json(response_json);

    if (valid_json) return transaction_response;

    return null;
}

export interface MintInfo {
    mint: Mint;
    program: PublicKey;
}

export interface MetaData {
    key: PublicKey;
    signer: boolean;
    writable: boolean;
}

interface AccountData {
    id: number;
    jsonrpc: string;
    result: {
        context: {
            apiVersion: string;
            slot: number;
        };
        value: {
            data: [string, string];
            executable: boolean;
            lamports: number;
            owner: string;
        };
    };
    error: string;
}

export class Token22MintAccount {
    constructor(
        readonly mintOption: number,
        readonly mintAuthority: PublicKey,
        readonly supply: bignum,
        readonly decimals: number,
        readonly isInitialized: number,
        readonly freezeOption: number,
        readonly freezeAuthority: PublicKey,
    ) {}

    static readonly struct = new FixableBeetStruct<Token22MintAccount>(
        [
            ["mintOption", u32],
            ["mintAuthority", publicKey],
            ["supply", u64],
            ["decimals", u8],
            ["isInitialized", u8],
            ["freezeOption", u32],
            ["freezeAuthority", publicKey],
        ],
        (args) =>
            new Token22MintAccount(
                args.mintOption!,
                args.mintAuthority!,
                args.supply!,
                args.decimals!,
                args.isInitialized!,
                args.freezeOption!,
                args.freezeAuthority!,
            ),
        "Token22MintAccount",
    );
}

export class TokenAccount {
    constructor(
        readonly mint: PublicKey,
        readonly owner: PublicKey,
        readonly amount: bignum,
        readonly delegate: COption<PublicKey>,
        readonly state: number,
        readonly is_native: COption<bignum>,
        readonly delegated_amount: bignum,
        readonly close_authority: COption<PublicKey>,
    ) {}

    static readonly struct = new FixableBeetStruct<TokenAccount>(
        [
            ["mint", publicKey],
            ["owner", publicKey],
            ["amount", u64],
            ["delegate", coption(publicKey)],
            ["state", u8],
            ["is_native", coption(u64)],
            ["delegated_amount", u64],
            ["close_authority", coption(publicKey)],
        ],
        (args) =>
            new TokenAccount(
                args.mint!,
                args.owner!,
                args.amount!,
                args.delegate!,
                args.state!,
                args.is_native!,
                args.delegated_amount!,
                args.close_authority!,
            ),
        "TokenAccount",
    );
}

interface TokenBalanceData {
    id: number;
    jsonrpc: string;
    result: {
        context: {
            apiVersion: string;
            slot: number;
        };
        value: {
            amount: string;
            decimals: number;
            uiAmount: number;
            uiAmountString: string;
        };
    };
    error: string;
}

class InstructionNoArgs {
    constructor(readonly instruction: number) {}

    static readonly struct = new BeetStruct<InstructionNoArgs>(
        [["instruction", u8]],
        (args) => new InstructionNoArgs(args.instruction!),
        "InstructionNoArgs",
    );
}

export async function request_current_balance(bearer: string, pubkey: PublicKey): Promise<number> {
    var body = {
        id: 1,
        jsonrpc: "2.0",
        method: "getAccountInfo",
        params: [pubkey.toString(), { encoding: "base64", commitment: "confirmed" }],
    };

    var account_info_result;
    try {
        account_info_result = await postData(Config.RPC_NODE, bearer, body);
    } catch (error) {
        console.log(error);
        return 0;
    }
    let valid_response = check_json(account_info_result);
    if (!valid_response) {
        console.log(account_info_result);
        return 0;
    }

    if (account_info_result["result"]["value"] == null || account_info_result["result"]["value"]["lamports"] == null) {
        console.log("Error getting lamports for ", pubkey.toString());
        return 0;
    }

    let current_balance: number = account_info_result["result"]["value"]["lamports"] / LAMPORTS_PER_SOL;

    return current_balance;
}

export async function requestMultipleAccounts(bearer: string, pubkeys: PublicKey[]): Promise<Buffer[]> {
    let key_strings = [];
    for (let i = 0; i < pubkeys.length; i++) {
        key_strings.push(pubkeys[i].toString());
    }

    var body = {
        id: 1,
        jsonrpc: "2.0",
        method: "getMultipleAccounts",
        params: [key_strings, { encoding: "base64", commitment: "confirmed" }],
    };

    var result;
    try {
        result = await postData(Config.RPC_NODE, bearer, body);
    } catch (error) {
        console.log(error);
        return [];
    }
    let valid_response = check_json(result);
    if (!valid_response) {
        console.log(result);
        return [];
    }

    var data: Buffer[] = [];
    for (let i = 0; i < result["result"]["value"].length; i++) {
        data.push(Buffer.from(result["result"]["value"][i]["data"][0], "base64"));
    }

    return data;
}

export async function RequestTokenHolders(mint: PublicKey): Promise<number> {
    let mint_bytes = mint.toBase58();

    var body = {
        id: 1,
        jsonrpc: "2.0",
        method: "getProgramAccounts",
        params: [
            TOKEN_2022_PROGRAM_ID.toString(),
            {
                filters: [{ memcmp: { offset: 0, bytes: mint_bytes } }],
                encoding: "base64",
                commitment: "confirmed",
            },
        ],
    };

    var program_accounts_result;
    try {
        program_accounts_result = await postData(Config.RPC_NODE, "", body);
    } catch (error) {
        console.log(error);
        return 0;
    }

    console.log("request token holders:");
    console.log(program_accounts_result["result"].length);

    return program_accounts_result["result"].length;
}

export async function request_token_supply(bearer: string, mint: PublicKey): Promise<number> {
    var body = {
        id: 1,
        jsonrpc: "2.0",
        method: "getTokenSupply",
        params: [mint.toString(), { encoding: "base64", commitment: "confirmed" }],
    };

    var response;
    try {
        response = await postData(Config.RPC_NODE, bearer, body);
    } catch (error) {
        console.log(error);
        return 0;
    }
    //console.log("TS result: ", response)

    let valid_response = check_json(response);

    //console.log("valid ", valid_response);
    if (!valid_response) {
        return 0;
    }

    let token_amount;
    try {
        let parsed_response: TokenBalanceData = response;

        //console.log("parsed", parsed_account_data);

        token_amount = parseInt(parsed_response.result.value.amount);
    } catch (error) {
        console.log(error);
        return 0;
    }

    return token_amount;
}

export async function request_token_amount(bearer: string, pubkey: PublicKey): Promise<number> {
    var body = {
        id: 1,
        jsonrpc: "2.0",
        method: "getTokenAccountBalance",
        params: [pubkey.toString(), { encoding: "base64", commitment: "confirmed" }],
    };

    var response;
    try {
        response = await postData(Config.RPC_NODE, bearer, body);
    } catch (error) {
        console.log(error);
        return 0;
    }
    //console.log("TS result: ", response)

    let valid_response = check_json(response);

    //console.log("valid ", valid_response);
    if (!valid_response) {
        return 0;
    }

    let token_amount;
    try {
        let parsed_response: TokenBalanceData = response;

        //console.log("parsed", parsed_account_data);

        token_amount = parseInt(parsed_response.result.value.amount);
    } catch (error) {
        console.log(error);
        return 0;
    }

    return token_amount;
}

export async function request_raw_account_data(bearer: string, pubkey: PublicKey): Promise<Buffer | null> {
    var body = {
        id: 1,
        jsonrpc: "2.0",
        method: "getAccountInfo",
        params: [pubkey.toString(), { encoding: "base64", commitment: "confirmed" }],
    };

    var response;
    try {
        response = await postData(Config.RPC_NODE, bearer, body);
    } catch (error) {
        console.log(error);
        return null;
    }
    //console.log("TS result: ", response)

    let valid_response = check_json(response);

    //console.log("valid ", valid_response);
    if (!valid_response) {
        return null;
    }

    let account_data;
    try {
        let parsed_account_data: AccountData = response;

        if (parsed_account_data.result.value === null) {
            return null;
        }

        let account_encoded_data = parsed_account_data.result.value.data;
        account_data = Buffer.from(account_encoded_data[0], "base64");
    } catch (error) {
        console.log(error);
        return null;
    }

    return account_data;
}

export function serialise_basic_instruction(instruction: number): Buffer {
    const data = new InstructionNoArgs(instruction);
    const [buf] = InstructionNoArgs.struct.serialize(data);

    return buf;
}

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////// LetsCook Instructions and MetaData /////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

type LaunchPluginEnum = {
    MintProbability: { mint_prob: number };
};
type LaunchPlugin = DataEnumKeyAsKind<LaunchPluginEnum>;

const launchPluginBeet = dataEnum<LaunchPluginEnum>([
    [
        "MintProbability",
        new BeetArgsStruct<LaunchPluginEnum["MintProbability"]>([["mint_prob", u16]], 'LaunchPluginEnum["MintProbability"]'),
    ],
]) as FixableBeet<LaunchPlugin>;

type LaunchMetaEnum = {
    Raffle: {};
};
type LaunchInfo = DataEnumKeyAsKind<LaunchMetaEnum>;

const launchInfoBeet = dataEnum<LaunchMetaEnum>([
    ["Raffle", new BeetArgsStruct<LaunchMetaEnum["Raffle"]>([], 'LaunchMetaEnum["Raffle"]')],
]) as FixableBeet<LaunchInfo>;

export interface JoinedLaunch {
    join_data: JoinData;
    launch_data: LaunchData;
}

export const enum Distribution {
    Raffle,
    LP,
    MMRewards,
    LPRewards,
    Airdrops,
    Team,
    Other,
    LENGTH,
}

export const enum LaunchInstruction {
    init = 0,
    create_game = 1,
    buy_tickets = 2,
    chcek_tickets = 3,
    init_market = 4,
    hype_vote = 5,
    claim_refund = 6,
    edit_launch = 7,
    claim_tokens = 8,
    edit_user = 9,
    place_market_order = 10,
    get_mm_rewards = 11,
    close_account = 12,
    launch_collection = 13,
    claim_nft = 14,
    mint_nft = 15,
    wrap_nft = 16,
    edit_collection = 17,
    mint_random = 18,
}

export interface LaunchDataUserInput {
    edit_mode: boolean;
    name: string;
    symbol: string;
    icon_file: File | null;
    uri_file: File | null;
    banner_file: File | null;
    icon_url: string;
    banner_url: string;
    total_supply: number;
    decimals: number;
    num_mints: number;
    minimum_liquidity: number;
    ticket_price: number;
    distribution: number[];
    uri: string;
    pagename: string;
    description: string;
    web_url: string;
    tele_url: string;
    twt_url: string;
    disc_url: string;
    displayImg: string;
    opendate: Date;
    closedate: Date;
    team_wallet: string;
    token_keypair: Keypair | null;
    amm_fee: number;
    // extension data
    token_program: PublicKey | null;
    transfer_fee: number;
    max_transfer_fee: number;
    permanent_delegate: PublicKey | null;
    transfer_hook_program: PublicKey | null;
}

export const defaultUserInput: LaunchDataUserInput = {
    edit_mode: false,
    name: "",
    symbol: "",
    icon_file: null,
    uri_file: null,
    banner_file: null,
    icon_url: "",
    banner_url: "",
    displayImg: null,
    total_supply: 0,
    decimals: 1,
    num_mints: 0,
    minimum_liquidity: 0,
    ticket_price: 0,
    distribution: new Array(Distribution.LENGTH).fill(0),
    uri: "",
    pagename: "",
    description: "",
    web_url: "",
    tele_url: "",
    twt_url: "",
    disc_url: "",
    opendate: new Date(new Date().setHours(0, 0, 0, 0)),
    closedate: new Date(new Date().setHours(0, 0, 0, 0)),
    team_wallet: "",
    token_keypair: null,
    amm_fee: 0,
    token_program: null,
    transfer_fee: 0,
    max_transfer_fee: 0,
    permanent_delegate: null,
    transfer_hook_program: null,
};

export class myU64 {
    constructor(readonly value: bignum) {}

    static readonly struct = new BeetStruct<myU64>([["value", u64]], (args) => new myU64(args.value!), "myU64");
}

export class LaunchData {
    constructor(
        readonly account_type: number,
        readonly launch_meta: LaunchMetaEnum,
        readonly plugins: LaunchPluginEnum[],
        readonly game_id: bignum,
        readonly last_interaction: bignum,
        readonly num_interactions: number,

        readonly name: string,
        readonly symbol: string,
        readonly icon: string,
        readonly meta_url: string,
        readonly banner: string,
        readonly page_name: string,
        readonly description: string,

        readonly total_supply: bignum,
        readonly decimals: number,
        readonly num_mints: bignum,
        readonly ticket_price: bignum,
        readonly minimum_liquidity: bignum,
        readonly launch_date: bignum,
        readonly end_date: bignum,

        readonly tickets_sold: number,
        readonly tickets_claimed: number,
        readonly mints_won: number,
        readonly positive_votes: number,
        readonly negative_votes: number,

        readonly total_mm_buy_amount: bignum,
        readonly total_mm_sell_amount: bignum,
        readonly last_mm_reward_date: number,

        readonly socials: string[],
        readonly distribution: number[],
        readonly flags: number[],
        readonly strings: string[],
        readonly keys: PublicKey[],
    ) {}

    static readonly struct = new FixableBeetStruct<LaunchData>(
        [
            ["account_type", u8],
            ["launch_meta", launchInfoBeet],
            ["plugins", array(launchPluginBeet)],
            ["game_id", u64],
            ["last_interaction", i64],
            ["num_interactions", u16],

            ["name", utf8String],
            ["symbol", utf8String],
            ["icon", utf8String],
            ["meta_url", utf8String],
            ["banner", utf8String],
            ["page_name", utf8String],
            ["description", utf8String],

            ["total_supply", u64],
            ["decimals", u8],
            ["num_mints", u32],
            ["ticket_price", u64],
            ["minimum_liquidity", u64],
            ["launch_date", u64],
            ["end_date", u64],

            ["tickets_sold", u32],
            ["tickets_claimed", u32],
            ["mints_won", u32],
            ["positive_votes", u32],
            ["negative_votes", u32],

            ["total_mm_buy_amount", u64],
            ["total_mm_sell_amount", u64],
            ["last_mm_reward_date", u32],

            ["socials", array(utf8String)],
            ["distribution", array(u8)],
            ["flags", array(u8)],
            ["strings", array(utf8String)],
            ["keys", array(publicKey)],
        ],
        (args) =>
            new LaunchData(
                args.account_type!,
                args.launch_meta!,
                args.plugins!,
                args.game_id!,
                args.last_interaction!,
                args.num_interactions!,

                args.name!,
                args.symbol!,
                args.icon!,
                args.meta_url!,
                args.banner!,
                args.page_name!,
                args.description!,

                args.total_supply!,
                args.decimals!,
                args.num_mints!,
                args.ticket_price!,
                args.minimum_liquidity!,
                args.launch_date!,
                args.end_date!,

                args.tickets_sold!,
                args.tickets_claimed!,
                args.mints_won!,
                args.positive_votes!,
                args.negative_votes!,

                args.total_mm_buy_amount!,
                args.total_mm_sell_amount!,
                args.last_mm_reward_date!,

                args.socials!,
                args.distribution!,
                args.flags!,
                args.strings!,
                args.keys!,
            ),
        "LaunchData",
    );
}

export function create_LaunchData(new_launch_data: LaunchDataUserInput): LaunchData {
    // console.log(new_launch_data);
    // console.log(new_launch_data.opendate.toString());
    // console.log(new_launch_data.closedate.toString());

    const banner_url = URL.createObjectURL(new_launch_data.banner_file);
    const icon_url = URL.createObjectURL(new_launch_data.icon_file);

    const meta: LaunchMetaEnum & { __kind: "Raffle" } = {
        __kind: "Raffle",
        Raffle: {},
    };
    const data = new LaunchData(
        1,
        meta,
        [],
        new BN(0),
        new BN(0),
        0,

        new_launch_data.name,
        new_launch_data.symbol,
        icon_url,
        "meta_data",
        banner_url,
        new_launch_data.pagename,
        new_launch_data.description,

        new BN(new_launch_data.total_supply),
        new_launch_data.decimals,
        new_launch_data.num_mints,
        new BN(new_launch_data.ticket_price * LAMPORTS_PER_SOL),
        new BN(new_launch_data.minimum_liquidity),
        new BN(new_launch_data.opendate.getTime()),
        new BN(new_launch_data.closedate.getTime()),

        0,
        0,
        0,
        0,
        0,

        new BN(0),
        new BN(0),
        0,

        [new_launch_data.web_url, new_launch_data.twt_url, new_launch_data.tele_url, new_launch_data.disc_url],
        new_launch_data.distribution,
        [],
        [],
        [],
    );

    return data;
}

export function create_LaunchDataInput(launch_data: LaunchData, edit_mode: boolean): LaunchDataUserInput {
    // console.log(new_launch_data);
    // console.log(new_launch_data.opendate.toString());
    // console.log(new_launch_data.closedate.toString());

    const data: LaunchDataUserInput = {
        edit_mode: edit_mode,
        name: launch_data.name,
        symbol: launch_data.symbol,
        icon_file: null,
        uri_file: null,
        banner_file: null,
        icon_url: launch_data.icon,
        banner_url: launch_data.banner,
        displayImg: launch_data.icon,
        total_supply: bignum_to_num(launch_data.total_supply),
        decimals: launch_data.decimals,
        num_mints: launch_data.num_mints,
        minimum_liquidity: (bignum_to_num(launch_data.ticket_price) * launch_data.num_mints) / LAMPORTS_PER_SOL,
        ticket_price: bignum_to_num(launch_data.ticket_price) / LAMPORTS_PER_SOL,
        distribution: launch_data.distribution,
        uri: launch_data.meta_url,
        pagename: launch_data.page_name,
        description: launch_data.description,
        web_url: launch_data.socials[Socials.Website].toString(),
        tele_url: launch_data.socials[Socials.Telegram].toString(),
        twt_url: launch_data.socials[Socials.Twitter].toString(),
        disc_url: launch_data.socials[Socials.Discord].toString(),
        opendate: new Date(bignum_to_num(launch_data.launch_date)),
        closedate: new Date(bignum_to_num(launch_data.end_date)),
        team_wallet: launch_data.keys[LaunchKeys.TeamWallet].toString(),
        token_keypair: null,
        amm_fee: 0,
        token_program: null,
        transfer_fee: 0,
        max_transfer_fee: 0,
        permanent_delegate: null,
        transfer_hook_program: null,
    };

    return data;
}

export class JoinData {
    constructor(
        readonly account_type: number,
        readonly joiner_key: PublicKey,
        readonly game_id: bignum,
        readonly num_tickets: number,
        readonly num_claimed_tickets: number,
        readonly num_winning_tickets: number,
        readonly ticket_status: number,
    ) {}

    static readonly struct = new BeetStruct<JoinData>(
        [
            ["account_type", u8],
            ["joiner_key", publicKey],
            ["game_id", u64],
            ["num_tickets", u16],
            ["num_claimed_tickets", u16],
            ["num_winning_tickets", u16],
            ["ticket_status", u8],
        ],
        (args) =>
            new JoinData(
                args.account_type!,
                args.joiner_key!,
                args.game_id!,
                args.num_tickets!,
                args.num_claimed_tickets!,
                args.num_winning_tickets!,
                args.ticket_status!,
            ),
        "JoinData",
    );
}

export class UserStats {
    constructor(
        readonly flags: number[],
        readonly values: number[],
        readonly amounts: bignum[],
        readonly achievements: number[],
    ) {}

    static readonly struct = new FixableBeetStruct<UserStats>(
        [
            ["flags", array(u8)],
            ["values", array(u32)],
            ["amounts", array(u64)],
            ["achievements", array(u8)],
        ],
        (args) => new UserStats(args.flags!, args.values!, args.amounts!, args.achievements!),
        "UserStats",
    );
}

export class UserData {
    constructor(
        readonly account_type: number,
        readonly user_key: PublicKey,
        readonly user_name: string,
        readonly total_points: number,
        readonly votes: number[],
        readonly stats: UserStats,
    ) {}

    static readonly struct = new FixableBeetStruct<UserData>(
        [
            ["account_type", u8],
            ["user_key", publicKey],
            ["user_name", utf8String],
            ["total_points", u32],
            ["votes", array(u64)],
            ["stats", UserStats.struct],
        ],
        (args) => new UserData(args.account_type!, args.user_key!, args.user_name!, args.total_points!, args.votes!, args.stats!),
        "UserData",
    );
}

export async function request_launch_data(bearer: string, pubkey: PublicKey): Promise<LaunchData | null> {
    let account_data = await request_raw_account_data(bearer, pubkey);

    if (account_data === null) {
        return null;
    }

    const [data] = LaunchData.struct.deserialize(account_data);

    return data;
}

export interface GPAccount {
    pubkey: PublicKey;
    data: Buffer;
}

export async function RunGPA(): Promise<GPAccount[]> {
    var body = {
        id: 1,
        jsonrpc: "2.0",
        method: "getProgramAccounts",
        params: [PROGRAM.toString(), { encoding: "base64", commitment: "confirmed" }],
    };

    var program_accounts_result;
    try {
        program_accounts_result = await postData(Config.RPC_NODE, "", body);
    } catch (error) {
        console.log(error);
        return [];
    }

    //console.log(program_accounts_result["result"]);

    let result = [];
    for (let i = 0; i < program_accounts_result["result"]?.length; i++) {
        //console.log(i, program_accounts_result["result"][i]);
        let encoded_data = program_accounts_result["result"][i]["account"]["data"][0];
        let decoded_data = Buffer.from(encoded_data, "base64");

        // we dont want the program account
        if (decoded_data[0] === 1) continue;

        result.push({ pubkey: new PublicKey(program_accounts_result["result"][i]["pubkey"]), data: decoded_data });
    }

    return result;
}

class CreateLaunch_Instruction {
    constructor(
        readonly instruction: number,
        readonly name: string,
        readonly symbol: string,
        readonly uri: string,
        readonly icon: string,
        readonly banner: string,
        readonly total_supply: bignum,
        readonly decimals: number,
        readonly launch_date: bignum,
        readonly close_date: bignum,
        readonly num_mints: number,
        readonly ticket_price: bignum,
        readonly page_name: string,
        readonly transfer_fee: number,
        readonly max_transfer_fee: bignum,
        readonly extensions: number,
    ) {}

    static readonly struct = new FixableBeetStruct<CreateLaunch_Instruction>(
        [
            ["instruction", u8],
            ["name", utf8String],
            ["symbol", utf8String],
            ["uri", utf8String],
            ["icon", utf8String],
            ["banner", utf8String],
            ["total_supply", u64],
            ["decimals", u8],
            ["launch_date", u64],
            ["close_date", u64],
            ["num_mints", u32],
            ["ticket_price", u64],
            ["page_name", utf8String],
            ["transfer_fee", u16],
            ["max_transfer_fee", u64],
            ["extensions", u8],
        ],
        (args) =>
            new CreateLaunch_Instruction(
                args.instruction!,
                args.name!,
                args.symbol!,
                args.uri!,
                args.icon!,
                args.banner!,
                args.total_supply!,
                args.decimals!,
                args.launch_date!,
                args.close_date!,
                args.num_mints!,
                args.ticket_price!,
                args.page_name!,
                args.transfer_fee!,
                args.max_transfer_fee!,
                args.extensions!,
            ),
        "CreateLaunch_Instruction",
    );
}

export function serialise_CreateLaunch_instruction(new_launch_data: LaunchDataUserInput): Buffer {
    // console.log(new_launch_data);
    // console.log(new_launch_data.opendate.toString());
    // console.log(new_launch_data.closedate.toString());

    let extensions =
        (Extensions.TransferFee * Number(new_launch_data.transfer_fee > 0)) |
        (Extensions.PermanentDelegate * Number(new_launch_data.permanent_delegate !== null)) |
        (Extensions.TransferHook * Number(new_launch_data.transfer_hook_program !== null));

    const data = new CreateLaunch_Instruction(
        LaunchInstruction.create_game,
        new_launch_data.name,
        new_launch_data.symbol,
        new_launch_data.uri,
        new_launch_data.icon_url,
        new_launch_data.banner_url,
        new_launch_data.total_supply,
        new_launch_data.decimals,
        new_launch_data.opendate.getTime(),
        new_launch_data.closedate.getTime(),
        new_launch_data.num_mints,
        new_launch_data.ticket_price * LAMPORTS_PER_SOL,
        new_launch_data.pagename,
        new_launch_data.transfer_fee,
        new_launch_data.max_transfer_fee,
        extensions,
    );
    const [buf] = CreateLaunch_Instruction.struct.serialize(data);

    return buf;
}

class EditLaunch_Instruction {
    constructor(
        readonly instruction: number,
        readonly description: string,
        readonly distribution: number[],
        readonly website: string,
        readonly twitter: string,
        readonly telegram: string,
        readonly discord: string,
        readonly amm_fee: number,
    ) {}

    static readonly struct = new FixableBeetStruct<EditLaunch_Instruction>(
        [
            ["instruction", u8],
            ["description", utf8String],
            ["distribution", array(u8)],
            ["website", utf8String],
            ["twitter", utf8String],
            ["telegram", utf8String],
            ["discord", utf8String],
            ["amm_fee", u16],
        ],
        (args) =>
            new EditLaunch_Instruction(
                args.instruction!,
                args.description!,
                args.distribution!,
                args.website!,
                args.twitter!,
                args.telegram!,
                args.discord!,
                args.amm_fee!,
            ),
        "EditLaunch_Instruction",
    );
}

export function serialise_EditLaunch_instruction(new_launch_data: LaunchDataUserInput): Buffer {
    const data = new EditLaunch_Instruction(
        LaunchInstruction.edit_launch,
        new_launch_data.description,
        new_launch_data.distribution,
        new_launch_data.web_url,
        new_launch_data.twt_url,
        new_launch_data.tele_url,
        new_launch_data.disc_url,
        new_launch_data.amm_fee,
    );
    const [buf] = EditLaunch_Instruction.struct.serialize(data);

    return buf;
}

class EditUser_Instruction {
    constructor(
        readonly instruction: number,
        readonly name: string,
    ) {}

    static readonly struct = new FixableBeetStruct<EditUser_Instruction>(
        [
            ["instruction", u8],
            ["name", utf8String],
        ],
        (args) => new EditUser_Instruction(args.instruction!, args.name!),
        "EditUser_Instruction",
    );
}

export function serialise_EditUser_instruction(name: string): Buffer {
    const data = new EditUser_Instruction(LaunchInstruction.edit_user, name);
    const [buf] = EditUser_Instruction.struct.serialize(data);

    return buf;
}

class HypeVote_Instruction {
    constructor(
        readonly instruction: number,
        readonly launch_type: number,
        readonly game_id: bignum,
        readonly vote: number,
    ) {}

    static readonly struct = new BeetStruct<HypeVote_Instruction>(
        [
            ["instruction", u8],
            ["launch_type", u8],
            ["game_id", u64],
            ["vote", u8],
        ],
        (args) => new HypeVote_Instruction(args.instruction!, args.launch_type!, args.game_id!, args.vote!),
        "HypeVote_Instruction",
    );
}

export function serialise_HypeVote_instruction(launch_type: number, game_id: bignum, vote: number): Buffer {
    const data = new HypeVote_Instruction(LaunchInstruction.hype_vote, launch_type, game_id, vote);
    const [buf] = HypeVote_Instruction.struct.serialize(data);

    return buf;
}

class BuyTickets_Instruction {
    constructor(
        readonly instruction: number,
        readonly num_tickets: number,
    ) {}

    static readonly struct = new BeetStruct<BuyTickets_Instruction>(
        [
            ["instruction", u8],
            ["num_tickets", u16],
        ],
        (args) => new BuyTickets_Instruction(args.instruction!, args.num_tickets!),
        "BuyTickets_Instruction",
    );
}

export function serialise_BuyTickets_instruction(num_tickets: number): Buffer {
    const data = new BuyTickets_Instruction(LaunchInstruction.buy_tickets, num_tickets);
    const [buf] = BuyTickets_Instruction.struct.serialize(data);

    return buf;
}

class InitMarket_Instruction {
    constructor(
        readonly instruction: number,
        readonly vaultSignerNonce: bignum,
    ) {}

    static readonly struct = new FixableBeetStruct<InitMarket_Instruction>(
        [
            ["instruction", u8],
            ["vaultSignerNonce", u64],
        ],
        (args) => new InitMarket_Instruction(args.instruction, args.vaultSignerNonce!),
        "InitMarket_Instruction",
    );
}

export function serialise_InitMarket_Instruction(vaultSignerNonce: bignum): Buffer {
    const data = new InitMarket_Instruction(LaunchInstruction.init_market, vaultSignerNonce);
    const [buf] = InitMarket_Instruction.struct.serialize(data);

    return buf;
}

export function bignum_to_num(bn: bignum): number {
    let value = new BN(bn).toNumber();

    return value;
}

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////// Raydium Instructions and MetaData //////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

class RaydiumInitMarket_Instruction {
    constructor(
        readonly version: number,
        readonly instruction: number,
        readonly baseLotSize: bignum,
        readonly quoteLotSize: bignum,
        readonly feeRateBps: number,
        readonly vaultSignerNonce: bignum,
        readonly quoteDustThreshold: bignum,
    ) {}

    static readonly struct = new BeetStruct<RaydiumInitMarket_Instruction>(
        [
            ["version", u8],
            ["instruction", u32],
            ["baseLotSize", u64],
            ["quoteLotSize", u64],
            ["feeRateBps", u16],
            ["vaultSignerNonce", u64],
            ["quoteDustThreshold", u64],
        ],
        (args) =>
            new RaydiumInitMarket_Instruction(
                args.version!,
                args.instruction!,
                args.baseLotSize!,
                args.quoteLotSize!,
                args.feeRateBps!,
                args.vaultSignerNonce!,
                args.quoteDustThreshold!,
            ),
        "RaydiumInitMarket_Instruction",
    );
}

export function serialise_RaydiumInitMarket_Instruction(
    version: number,
    instruction: number,
    baseLotSize: bignum,
    quoteLotSize: bignum,
    feeRateBps: number,
    vaultSignerNonce: bignum,
    quoteDustThreshold: bignum,
): Buffer {
    const data = new RaydiumInitMarket_Instruction(
        version,
        instruction,
        baseLotSize,
        quoteLotSize,
        feeRateBps,
        vaultSignerNonce,
        quoteDustThreshold,
    );
    const [buf] = RaydiumInitMarket_Instruction.struct.serialize(data);

    return buf;
}

class RaydiumCreatePool_Instruction {
    constructor(
        readonly instruction: number,
        readonly nonce: number,
        readonly openTime: bignum,
        readonly pcAmount: bignum,
        readonly coinAmount: bignum,
    ) {}

    static readonly struct = new BeetStruct<RaydiumCreatePool_Instruction>(
        [
            ["instruction", u8],
            ["nonce", u8],
            ["openTime", u64],
            ["pcAmount", u64],
            ["coinAmount", u64],
        ],
        (args) => new RaydiumCreatePool_Instruction(args.instruction!, args.nonce!, args.openTime!, args.pcAmount!, args.coinAmount!),
        "RaydiumCreatePool_Instruction",
    );
}

export function serialise_RaydiumCreatePool_Instruction(nonce: number, openTime: bignum, pcAmount: bignum, coinAmount: bignum): Buffer {
    const data = new RaydiumCreatePool_Instruction(1, nonce, openTime, pcAmount, coinAmount);
    const [buf] = RaydiumCreatePool_Instruction.struct.serialize(data);

    return buf;
}

export class MarketStateLayoutV2 {
    constructor(
        readonly header: number[],
        readonly accountFlags: bignum,
        readonly ownAddress: PublicKey,
        readonly vaultSignerNonce: bignum,
        readonly baseMint: PublicKey,
        readonly quoteMint: PublicKey,
        readonly baseVault: PublicKey,
        readonly baseDepositsTotal: bignum,
        readonly baseFeesAccrued: bignum,
        readonly quoteVault: PublicKey,
        readonly quoteDepositsTotal: bignum,
        readonly quoteFeesAccrued: bignum,
        readonly quoteDustThreshold: bignum,
        readonly requestQueue: PublicKey,
        readonly eventQueue: PublicKey,
        readonly bids: PublicKey,
        readonly asks: PublicKey,
        readonly baseLotSize: bignum,
        readonly quoteLotSize: bignum,
        readonly feeRateBps: bignum,
        readonly referrerRebatesAccrued: bignum,
        readonly footer: number[],
    ) {}

    static readonly struct = new BeetStruct<MarketStateLayoutV2>(
        [
            ["header", uniformFixedSizeArray(u8, 5)],
            ["accountFlags", u64],
            ["ownAddress", publicKey],
            ["vaultSignerNonce", u64],
            ["baseMint", publicKey],
            ["quoteMint", publicKey],
            ["baseVault", publicKey],
            ["baseDepositsTotal", u64],
            ["baseFeesAccrued", u64],
            ["quoteVault", publicKey],
            ["quoteDepositsTotal", u64],
            ["quoteFeesAccrued", u64],
            ["quoteDustThreshold", u64],
            ["requestQueue", publicKey],
            ["eventQueue", publicKey],
            ["bids", publicKey],
            ["asks", publicKey],
            ["baseLotSize", u64],
            ["quoteLotSize", u64],
            ["feeRateBps", u64],
            ["referrerRebatesAccrued", u64],
            ["footer", uniformFixedSizeArray(u8, 7)],
        ],
        (args) =>
            new MarketStateLayoutV2(
                args.header!,
                args.accountFlags!,
                args.ownAddress!,
                args.vaultSignerNonce!,
                args.baseMint!,
                args.quoteMint!,
                args.baseVault!,
                args.baseDepositsTotal!,
                args.baseFeesAccrued!,
                args.quoteVault!,
                args.quoteDepositsTotal!,
                args.quoteFeesAccrued!,
                args.quoteDustThreshold!,
                args.requestQueue!,
                args.eventQueue!,
                args.bids!,
                args.asks!,
                args.baseLotSize!,
                args.quoteLotSize!,
                args.feeRateBps!,
                args.referrerRebatesAccrued!,
                args.footer!,
            ),
        "MarketStateLayoutV2",
    );
}

// transfer hook state

/** ExtraAccountMeta as stored by the transfer hook program */
export class ExtraAccountMeta {
    constructor(
        readonly discriminator: number,
        readonly addressConfig: number[],
        readonly isSigner: number,
        readonly isWritable: number,
    ) {}

    static readonly struct = new FixableBeetStruct<ExtraAccountMeta>(
        [
            ["discriminator", u8],
            ["addressConfig", uniformFixedSizeArray(u8, 32)],
            ["isSigner", u8],
            ["isWritable", u8],
        ],
        (args) => new ExtraAccountMeta(args.discriminator!, args.addressConfig!, args.isSigner!, args.isWritable!),
        "ExtraAccountMeta",
    );
}

export class ExtraAccountMetaHead {
    constructor(
        readonly discriminator: bignum,
        readonly length: number,
        readonly count: number,
    ) {}

    static readonly struct = new FixableBeetStruct<ExtraAccountMetaHead>(
        [
            ["discriminator", u64],
            ["length", u32],
            ["count", u32],
        ],
        (args) => new ExtraAccountMetaHead(args.discriminator!, args.length!, args.count!),
        "ExtraAccountMetaHead",
    );
}
