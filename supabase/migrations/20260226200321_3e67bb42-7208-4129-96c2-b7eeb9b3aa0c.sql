-- Clean up incorrectly synced transactions (all 19 current records are bad data from wrong agent matching)
DELETE FROM transaction_coordination WHERE otc_deal_id IS NOT NULL;
-- Also delete the seed/demo record
DELETE FROM transaction_coordination WHERE otc_deal_id = 'otc_deal_001';