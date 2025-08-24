mod pb;

use pb::jupiter::types::v1::{Swap, Pool, Token, Route};
use substreams::errors::Error;
use substreams::log;
use substreams_entity_change::pb::entity::EntityChanges;
use substreams_entity_change::tables::Tables;
use substreams_solana::pb::sf::solana::type::v1::{Block, ConfirmedTransaction, InstructionView, TransactionStatusMeta};
use substreams_solana::pb::sf::solana::type::v1::confirmed_transaction::Transaction;
use substreams_solana_program_instructions::jupiter::{self, JupiterInstruction};
use derive_deserialize::AccountsDeserialize;
use substreams_solana::pb::sf::solana::r#type::v1::InnerInstructions;

// Jupiter program IDs
const JUPITER_V3_PROGRAM_ID: &str = "JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph";
const JUPITER_V4_PROGRAM_ID: &str = "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB";
const JUPITER_V6_PROGRAM_ID: &str = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

#[substreams::handlers::map]
fn map_swaps(block: Block) -> Result<Vec<Swap>, Error> {
    let mut swaps = Vec::new();
    
    for trx in block.transactions() {
        if let Some(swap) = extract_swap_from_transaction(&block, trx) {
            swaps.push(swap);
        }
    }
    
    Ok(swaps)
}

#[substreams::handlers::map]
fn map_pools(block: Block) -> Result<Vec<Pool>, Error> {
    let mut pools = Vec::new();
    
    // Extract pool information from transactions
    // This is a placeholder - you'll need to implement the actual logic
    
    Ok(pools)
}

#[substreams::handlers::map]
fn map_tokens(block: Block) -> Result<Vec<Token>, Error> {
    let mut tokens = Vec::new();
    
    // Extract token information from transactions
    // This is a placeholder - you'll need to implement the actual logic
    
    Ok(tokens)
}

#[substreams::handlers::map]
fn map_routes(block: Block) -> Result<Vec<Route>, Error> {
    let mut routes = Vec::new();
    
    // Extract route information from transactions
    // This is a placeholder - you'll need to implement the actual logic
    
    Ok(routes)
}

#[substreams::handlers::map]
fn graph_out(
    swaps: Vec<Swap>,
    pools: Vec<Pool>,
    tokens: Vec<Token>,
    routes: Vec<Route>,
) -> Result<EntityChanges, Error> {
    let mut tables = Tables::new();
    
    // Process swaps
    for swap in swaps {
        tables
            .create_row("Swap", swap.id.clone())
            .set("transactionHash", swap.transaction_hash)
            .set("blockNumber", swap.block_number)
            .set("blockTimestamp", swap.block_timestamp)
            .set("inputMint", swap.input_mint)
            .set("outputMint", swap.output_mint)
            .set("inputAmount", swap.input_amount)
            .set("outputAmount", swap.output_amount)
            .set("user", swap.user)
            .set("route", swap.route)
            .set("feeAmount", swap.fee_amount);
    }
    
    // Process pools
    for pool in pools {
        tables
            .create_row("Pool", pool.id.clone())
            .set("programId", pool.program_id)
            .set("tokenAMint", pool.token_a_mint)
            .set("tokenBMint", pool.token_b_mint)
            .set("tokenAAmount", pool.token_a_amount)
            .set("tokenBAmount", pool.token_b_amount)
            .set("feeRate", pool.fee_rate)
            .set("creationTimestamp", pool.creation_timestamp)
            .set("lastUpdateTimestamp", pool.last_update_timestamp);
    }
    
    // Process tokens
    for token in tokens {
        tables
            .create_row("Token", token.mint.clone())
            .set("symbol", token.symbol)
            .set("name", token.name)
            .set("decimals", token.decimals)
            .set("totalVolume", token.total_volume)
            .set("priceUsd", token.price_usd);
    }
    
    // Process routes
    for route in routes {
        tables
            .create_row("Route", route.id.clone())
            .set("inputMint", route.input_mint)
            .set("outputMint", route.output_mint)
            .set("inAmount", route.in_amount)
            .set("outAmount", route.out_amount)
            .set("priceImpact", route.price_impact)
            .set("marketInfoAddress", route.market_info_address);
    }
    
    Ok(tables.to_entity_changes())
}

fn extract_swap_from_transaction(block: &Block, trx: &ConfirmedTransaction) -> Option<Swap> {
    // Check if this is a Jupiter transaction
    let transaction = trx.transaction.as_ref()?;
    let Transaction::Legacy(legacy_tx) = transaction else { return None };
    
    // Check if any of the instructions are for Jupiter programs
    let is_jupiter_transaction = legacy_tx.message.as_ref()?.instructions.iter().any(|instr| {
        let program_id = instr.program_id_index as usize;
        let account_keys = &legacy_tx.message.as_ref().unwrap().account_keys;
        
        if program_id < account_keys.len() {
            let program_key = &account_keys[program_id];
            let program_key_str = bs58::encode(program_key).into_string();
            
            program_key_str == JUPITER_V3_PROGRAM_ID || 
            program_key_str == JUPITER_V4_PROGRAM_ID || 
            program_key_str == JUPITER_V6_PROGRAM_ID
        } else {
            false
        }
    });
    
    if !is_jupiter_transaction {
        return None;
    }
    
    // Extract swap details
    // This is a placeholder - you'll need to implement the actual logic to extract swap details
    // from Jupiter transactions
    
    let transaction_hash = bs58::encode(&trx.signature).into_string();
    let block_number = block.slot;
    let block_timestamp = block.block_time.as_ref()?.timestamp.to_string();
    
    // These fields would need to be extracted from the actual transaction data
    let input_mint = "placeholder_input_mint".to_string();
    let output_mint = "placeholder_output_mint".to_string();
    let input_amount = "0".to_string();
    let output_amount = "0".to_string();
    let user = "placeholder_user".to_string();
    let route = "placeholder_route".to_string();
    let fee_amount = "0".to_string();
    
    Some(Swap {
        id: transaction_hash.clone(),
        transaction_hash,
        block_number,
        block_timestamp,
        input_mint,
        output_mint,
        input_amount,
        output_amount,
        user,
        route,
        fee_amount,
    })
}

