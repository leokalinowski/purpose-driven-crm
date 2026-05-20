-- ============================================================
-- seed-demo-account.sql
--
-- Populates the REOP Hub demo account used in the sales process with
-- coherent, realistic data across every live surface — contacts,
-- pipeline, SphereSync, coaching/Scoreboard, Delight, events,
-- marketing settings.
--
-- The "sphere" is famous fictional characters (Tony Stark, Harry
-- Potter, etc.) so a demo audience instantly recognizes the names.
--
-- IDEMPOTENT — safe to re-run. It wipes every demo-owned row first,
-- then re-inserts. That makes it a "reset the demo" button: after a
-- messy sales call, re-run this and the account is pristine again.
--
-- The demo agent:
--   email   demo@realestateonpurpose.com
--   user_id 8e395af3-1a6a-4b6f-a689-e6ee65a77908   (auth.users — created
--           via the normal signup flow; this script never touches auth)
--
-- Deterministic UUIDs are used for contacts / opportunities / the event
-- so cross-references resolve without lookups and re-runs are stable.
--
-- Time-relative data (SphereSync tasks for "this week", 8 weeks of
-- coaching history, recent activity) is computed from CURRENT_DATE, so
-- the demo never goes stale — re-run it any week and it re-anchors.
--
-- USAGE
--   Apply via Supabase MCP execute_sql, the SQL editor, or psql.
-- ============================================================

BEGIN;

-- ── 0. Wipe existing demo data (idempotent reset) ───────────────────
DELETE FROM contact_activities WHERE agent_id = '8e395af3-1a6a-4b6f-a689-e6ee65a77908';
DELETE FROM spheresync_tasks   WHERE agent_id = '8e395af3-1a6a-4b6f-a689-e6ee65a77908';
DELETE FROM opportunities      WHERE agent_id = '8e395af3-1a6a-4b6f-a689-e6ee65a77908';
DELETE FROM event_rsvps        WHERE event_id IN (SELECT id FROM events WHERE agent_id = '8e395af3-1a6a-4b6f-a689-e6ee65a77908');
DELETE FROM events             WHERE agent_id = '8e395af3-1a6a-4b6f-a689-e6ee65a77908';
DELETE FROM coaching_submissions WHERE agent_id = '8e395af3-1a6a-4b6f-a689-e6ee65a77908';
DELETE FROM agent_growth_goals WHERE agent_id = '8e395af3-1a6a-4b6f-a689-e6ee65a77908';
DELETE FROM contacts           WHERE agent_id = '8e395af3-1a6a-4b6f-a689-e6ee65a77908';
DELETE FROM agent_marketing_settings WHERE user_id = '8e395af3-1a6a-4b6f-a689-e6ee65a77908';

-- ── 1. Agent profile ────────────────────────────────────────────────
-- The signup flow already created the profiles row. Fill it out so the
-- demo agent looks like a real, established agent.
-- NB: profiles.full_name is a generated column — never set it directly.
UPDATE profiles SET
  first_name = 'Jordan',
  last_name  = 'Rivera',
  email      = 'demo@realestateonpurpose.com',
  team_name  = 'Rivera Property Group',
  brokerage  = 'Keller Williams Realty',
  phone_number  = '(216) 555-0142',
  office_number = '(216) 555-0100',
  office_address = '1500 West 3rd Street, Suite 400, Cleveland, OH 44113',
  website    = 'https://riverapropertygroup.example.com',
  license_number = 'OH-SAL-2019-44821',
  state_licenses = ARRAY['OH'],
  annual_gci_goal = 250000,
  annual_closings_goal = 24,
  annual_conversations_goal = 1200,
  updated_at = now()
WHERE user_id = '8e395af3-1a6a-4b6f-a689-e6ee65a77908';

-- ── 2. Marketing / brand settings ───────────────────────────────────
INSERT INTO agent_marketing_settings (
  id, user_id, primary_color, secondary_color, sender_name,
  target_audience, tone_guidelines, brand_guidelines, what_not_to_say,
  example_copy, signature_block, scheduling_url, created_at, updated_at
) VALUES (
  gen_random_uuid(), '8e395af3-1a6a-4b6f-a689-e6ee65a77908',
  '#0fb1c4', '#005d6c', 'Jordan Rivera',
  'Move-up buyers and sellers in Greater Cleveland — established homeowners, growing families, and past clients.',
  'Warm, knowledgeable, and direct. Confident without being pushy. Talks like a trusted neighbor, not a salesperson.',
  'Lead with the relationship, not the transaction. Every message should feel personal. Use the client''s first name.',
  'No hype, no "act now" pressure, no jargon. Never promise a price or a timeline we can''t back up.',
  'Hi Sarah — saw three homes hit the market in your neighborhood this week. Want me to send the details? No rush, just thought of you.',
  E'Jordan Rivera\nRivera Property Group · Keller Williams Realty\n(216) 555-0142',
  'https://calendly.com/jordan-rivera-demo',
  now(), now()
);

-- ── 3. Contacts — the sphere (36 fictional characters) ──────────────
-- category = surname initial (drives the SphereSync letter rotation).
-- Deterministic UUIDs: c0000000-0000-4000-8000-0000000000NN.
INSERT INTO contacts (
  id, agent_id, first_name, last_name, category, contact_type,
  phone, email, address_1, city, state, zip_code, dnc,
  relationship_strength, last_activity_date, created_at, updated_at, notes,
  birthday, spouse_name, spouse_birthday, home_anniversary, gift_preferences,
  preferred_contact_method, engagement_trend
) VALUES
 ('c0000000-0000-4000-8000-000000000001','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Tony','Stark','S','past_client','(216) 555-0201','tony.stark@demo.reop','10880 Malibu Point','Cleveland','OH','44114',false,9, now()-interval '3 days', now()-interval '420 days', now(), 'Closed on the lakefront property in 2024. Refers constantly — best advocate in the sphere.', '1970-05-29','Pepper','1975-06-02','2024-05-27','Single-malt scotch, anything tech','email','stable'),
 ('c0000000-0000-4000-8000-000000000002','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Harry','Potter','P','sphere','(216) 555-0202','harry.potter@demo.reop','4 Privet Drive','Lakewood','OH','44107',false,7, now()-interval '12 days', now()-interval '300 days', now(), 'Met at the 2024 client appreciation event. First-time buyer potential in 12-18 months.', NULL,NULL,NULL,'2021-05-26',NULL,'text','warming'),
 ('c0000000-0000-4000-8000-000000000003','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Hermione','Granger','G','prospect','(216) 555-0203','hermione.granger@demo.reop','12 Grimmauld Place','Shaker Heights','OH','44120',false,6, now()-interval '5 days', now()-interval '90 days', now(), 'Actively looking — relocating for work. Pre-approved. Sharp, does her homework.', '1979-09-19',NULL,NULL,'2020-06-03','Books, good coffee','email','warming'),
 ('c0000000-0000-4000-8000-000000000004','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Bruce','Wayne','W','past_client','(216) 555-0204','bruce.wayne@demo.reop','1007 Mountain Drive','Cleveland Heights','OH','44106',false,8, now()-interval '22 days', now()-interval '500 days', now(), 'Listing the estate. High-value seller. Prefers discretion.', NULL,NULL,NULL,'2023-09-14','Prefers a donation to charity','call','stable'),
 ('c0000000-0000-4000-8000-000000000005','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Ellen','Ripley','R','sphere','(216) 555-0205','ellen.ripley@demo.reop','426 Nostromo Way','Rocky River','OH','44116',false,5, now()-interval '38 days', now()-interval '210 days', now(), 'Stays in touch around the holidays. Possible move-up buyer next year.', '1986-05-25',NULL,NULL,NULL,NULL,'call','stable'),
 ('c0000000-0000-4000-8000-000000000006','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Sarah','Connor','C','prospect','(216) 555-0206','sarah.connor@demo.reop','1984 Cyberdyne Ave','Parma','OH','44129',false,6, now()-interval '2 days', now()-interval '45 days', now(), 'Just started the conversation about selling — timing uncertain, motivated when ready.', NULL,NULL,NULL,'2019-08-29',NULL,'text','warming'),
 ('c0000000-0000-4000-8000-000000000007','8e395af3-1a6a-4b6f-a689-e6ee65a77908','James','Bond','B','past_client','(216) 555-0207','james.bond@demo.reop','007 Universal Exports','Westlake','OH','44145',false,8, now()-interval '8 days', now()-interval '260 days', now(), 'Under contract on the downtown condo. Smooth so far.', '1968-04-13',NULL,NULL,'2025-02-10','Fine wine, travel gear','call','stable'),
 ('c0000000-0000-4000-8000-000000000008','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Marty','McFly','M','prospect','(216) 555-0208','marty.mcfly@demo.reop','9303 Lyon Estates','Strongsville','OH','44136',false,6, now()-interval '6 days', now()-interval '70 days', now(), 'Consultation done — young buyer, FHA, needs the right starter home.', NULL,NULL,NULL,NULL,NULL,'text','warming'),
 ('c0000000-0000-4000-8000-000000000009','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Indiana','Jones','J','referral_partner','(216) 555-0209','indy.jones@demo.reop','Marshall College','University Heights','OH','44118',false,7, now()-interval '15 days', now()-interval '340 days', now(), 'Sends referrals 2-3x a year. Worth a quarterly lunch.', NULL,NULL,NULL,NULL,'Bourbon','email','stable'),
 ('c0000000-0000-4000-8000-00000000000a','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Leia','Organa','O','sphere','(216) 555-0210','leia.organa@demo.reop','1 Alderaan Court','Beachwood','OH','44122',false,7, now()-interval '4 days', now()-interval '180 days', now(), 'Texting rotation contact. Always responsive. Knows everyone in town.', NULL,NULL,NULL,'2018-05-24','Plants, local art','text','warming'),
 ('c0000000-0000-4000-8000-00000000000b','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Luke','Skywalker','S','prospect','(216) 555-0211','luke.skywalker@demo.reop','12 Tatooine Trail','Avon','OH','44011',false,7, now()-interval '1 days', now()-interval '60 days', now(), 'Touring actively. Motivated, financing ready. Close to writing an offer.', NULL,NULL,NULL,NULL,NULL,'call','warming'),
 ('c0000000-0000-4000-8000-00000000000c','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Vito','Corleone','C','past_seller','(216) 555-0212','vito.corleone@demo.reop','Long Beach Compound','Mentor','OH','44060',false,8, now()-interval '7 days', now()-interval '280 days', now(), 'Listing presentation done — large family estate. Decision pending.', '1955-12-07',NULL,NULL,NULL,'Cigars, espresso','call','stable'),
 ('c0000000-0000-4000-8000-00000000000d','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Forrest','Gump','G','sphere','(216) 555-0213','forrest.gump@demo.reop','Greenbow Lane','Medina','OH','44256',false,6, now()-interval '30 days', now()-interval '220 days', now(), 'Loyal past client''s referral. Easy to talk to. Birthday coming up.', '1944-06-06',NULL,NULL,NULL,'Chocolates','call','stable'),
 ('c0000000-0000-4000-8000-00000000000e','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Katniss','Everdeen','E','prospect','(216) 555-0214','katniss.everdeen@demo.reop','12 District Lane','Elyria','OH','44035',false,6, now()-interval '9 days', now()-interval '55 days', now(), 'Identified as a real buyer — needs more space, growing household.', NULL,NULL,NULL,NULL,NULL,'text','warming'),
 ('c0000000-0000-4000-8000-00000000000f','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Atticus','Finch','F','sphere','(216) 555-0215','atticus.finch@demo.reop','Maycomb Street','Hudson','OH','44236',false,7, now()-interval '44 days', now()-interval '390 days', now(), 'Long-time sphere contact. Pillar of the community — great for referrals.', NULL,NULL,NULL,NULL,'Books','email','stable'),
 ('c0000000-0000-4000-8000-000000000010','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Walter','White','W','prospect','(216) 555-0216','walter.white@demo.reop','308 Negra Arroyo Lane','Brunswick','OH','44212',true,3, now()-interval '60 days', now()-interval '120 days', now(), 'DNC — do not call. Email/text only. Cautious seller, privacy-focused.', NULL,NULL,NULL,NULL,NULL,'email','cooling'),
 ('c0000000-0000-4000-8000-000000000011','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Frodo','Baggins','B','prospect','(216) 555-0217','frodo.baggins@demo.reop','Bag End, Hobbiton','North Olmsted','OH','44070',false,5, now()-interval '3 days', now()-interval '20 days', now(), 'Brand-new conversation — referred by Indiana Jones. First-time buyer.', NULL,NULL,NULL,NULL,NULL,'text','warming'),
 ('c0000000-0000-4000-8000-000000000012','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Gandalf','Grey','G','sphere','(216) 555-0218','gandalf.grey@demo.reop','Isengard Road','Chagrin Falls','OH','44022',false,7, now()-interval '50 days', now()-interval '450 days', now(), 'Wise, well-connected sphere contact. Sends thoughtful referrals.', NULL,NULL,NULL,NULL,'Pipe tobacco, fireworks','email','stable'),
 ('c0000000-0000-4000-8000-000000000013','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Han','Solo','S','past_client','(216) 555-0219','han.solo@demo.reop','Millennium Falcon Dock','Lorain','OH','44052',false,8, now()-interval '18 days', now()-interval '370 days', now(), 'Past buyer. Quick decision-maker. Anniversary of his closing is soon.', NULL,'Leia',NULL,'2025-05-27','Anything fast','call','stable'),
 ('c0000000-0000-4000-8000-000000000014','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Norman','Bates','B','prospect','(216) 555-0220','norman.bates@demo.reop','Bates Motel, Highway 99','Painesville','OH','44077',true,2, now()-interval '95 days', now()-interval '110 days', now(), 'DNC. Inquiry went cold — not a fit right now.', NULL,NULL,NULL,NULL,NULL,'email','dormant'),
 ('c0000000-0000-4000-8000-000000000015','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Dorothy','Gale','G','sphere','(216) 555-0221','dorothy.gale@demo.reop','Yellow Brick Road','Berea','OH','44017',false,6, now()-interval '26 days', now()-interval '200 days', now(), 'Sphere contact. There''s no place like home — sentimental, loves her neighborhood.', NULL,NULL,NULL,NULL,NULL,'call','stable'),
 ('c0000000-0000-4000-8000-000000000016','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Rick','Blaine','B','past_client','(216) 555-0222','rick.blaine@demo.reop','Rick''s Cafe Americain','Cleveland','OH','44113',false,7, now()-interval '40 days', now()-interval '320 days', now(), 'Past client. Owns a small commercial property too. Of all the agents in all the towns...', NULL,NULL,NULL,NULL,'Champagne','email','stable'),
 ('c0000000-0000-4000-8000-000000000017','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Vincent','Vega','V','sphere','(216) 555-0223','vincent.vega@demo.reop','Jackrabbit Slim''s Blvd','Euclid','OH','44117',false,5, now()-interval '33 days', now()-interval '160 days', now(), 'Sphere contact in the call rotation. Catch him in the morning.', NULL,NULL,NULL,NULL,NULL,'call','stable'),
 ('c0000000-0000-4000-8000-000000000018','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Peter','Venkman','V','sphere','(216) 555-0224','peter.venkman@demo.reop','14 N Moore Street','Solon','OH','44139',false,6, now()-interval '48 days', now()-interval '240 days', now(), 'Sphere contact, call rotation. Funny, keeps it light. Who you gonna call.', NULL,NULL,NULL,NULL,NULL,'call','stable'),
 ('c0000000-0000-4000-8000-000000000019','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Maximus','Decimus','D','sphere','(216) 555-0225','maximus.decimus@demo.reop','Felix Plains','Twinsburg','OH','44087',true,4, now()-interval '70 days', now()-interval '290 days', now(), 'DNC. Strength and honor — reach out by email only.', NULL,NULL,NULL,NULL,NULL,'email','cooling'),
 ('c0000000-0000-4000-8000-00000000001a','8e395af3-1a6a-4b6f-a689-e6ee65a77908','John','McClane','M','past_buyer','(216) 555-0226','john.mcclane@demo.reop','Nakatomi Plaza','Cleveland','OH','44115',false,7, now()-interval '55 days', now()-interval '330 days', now(), 'Past buyer. Yippee-ki-yay — tough negotiator, loyal once you''ve earned it.', NULL,'Holly',NULL,'2024-12-24','Tools','call','stable'),
 ('c0000000-0000-4000-8000-00000000001b','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Elle','Woods','W','prospect','(216) 555-0227','elle.woods@demo.reop','Delta Nu House','Westlake','OH','44145',false,6, now()-interval '11 days', now()-interval '40 days', now(), 'Sharp, decisive buyer prospect. What, like it''s hard? Pre-approved already.', '1991-06-01',NULL,NULL,NULL,'Pink anything','text','warming'),
 ('c0000000-0000-4000-8000-00000000001c','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Andy','Dufresne','D','sphere','(216) 555-0228','andy.dufresne@demo.reop','Shawshank Way','Mansfield','OH','44901',false,6, now()-interval '62 days', now()-interval '410 days', now(), 'Patient, long-game sphere contact. Get busy living. Possible 2027 move.', NULL,NULL,NULL,NULL,NULL,'email','stable'),
 ('c0000000-0000-4000-8000-00000000001d','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Mia','Wallace','W','sphere','(216) 555-0229','mia.wallace@demo.reop','Jackrabbit Slim''s Blvd','Euclid','OH','44117',true,3, now()-interval '80 days', now()-interval '150 days', now(), 'DNC. Email only. Quiet sphere contact — keep it warm.', NULL,NULL,NULL,NULL,NULL,'email','cooling'),
 ('c0000000-0000-4000-8000-00000000001e','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Sherlock','Holmes','H','referral_partner','(216) 555-0230','sherlock.holmes@demo.reop','221B Baker Street','Cleveland Heights','OH','44118',false,8, now()-interval '14 days', now()-interval '360 days', now(), 'Top referral partner — notices everything, knows who''s about to move before they do.', NULL,NULL,NULL,NULL,'A good puzzle','email','warming'),
 ('c0000000-0000-4000-8000-00000000001f','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Ethan','Hunt','H','sphere','(216) 555-0231','ethan.hunt@demo.reop','IMF Field Office','Independence','OH','44131',false,6, now()-interval '36 days', now()-interval '270 days', now(), 'Sphere contact. Always on the move — your mission, should you choose to accept it.', NULL,NULL,NULL,NULL,NULL,'text','stable'),
 ('c0000000-0000-4000-8000-000000000020','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Beatrix','Kiddo','K','sphere','(216) 555-0232','beatrix.kiddo@demo.reop','El Paso Chapel Road','Aurora','OH','44202',false,5, now()-interval '52 days', now()-interval '230 days', now(), 'Sphere contact, the rare K rotation. Determined — when she decides to move, she moves.', NULL,NULL,NULL,NULL,NULL,'call','stable'),
 ('c0000000-0000-4000-8000-000000000021','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Jack','Dawson','D','past_buyer','(216) 555-0233','jack.dawson@demo.reop','RMS Titanic, Cabin E','Sandusky','OH','44870',false,7, now()-interval '28 days', now()-interval '300 days', now(), 'Past buyer — first-timer, all heart. Make it count. Anniversary soon.', NULL,'Rose',NULL,'2025-06-05','Sketchbooks','text','stable'),
 ('c0000000-0000-4000-8000-000000000022','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Lara','Croft','C','sphere','(216) 555-0234','lara.croft@demo.reop','Croft Manor','Gates Mills','OH','44040',false,6, now()-interval '41 days', now()-interval '380 days', now(), 'Sphere contact. Owns multiple properties — investor mindset, worth nurturing.', NULL,NULL,NULL,NULL,NULL,'email','stable'),
 ('c0000000-0000-4000-8000-000000000023','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Optimus','Prime','P','sphere','(216) 555-0235','optimus.prime@demo.reop','1 Autobot City','Macedonia','OH','44056',false,7, now()-interval '46 days', now()-interval '260 days', now(), 'Steady, dependable sphere contact. Freedom is the right of all sentient beings.', NULL,NULL,NULL,NULL,NULL,'call','stable'),
 ('c0000000-0000-4000-8000-000000000024','8e395af3-1a6a-4b6f-a689-e6ee65a77908','Inigo','Montoya','M','sphere','(216) 555-0236','inigo.montoya@demo.reop','Cliffs of Insanity Rd','Willoughby','OH','44094',false,6, now()-interval '19 days', now()-interval '340 days', now(), 'Memorable sphere contact. You killed his father — prepare to buy a house. Good for referrals.', NULL,NULL,NULL,NULL,'Fencing gear','call','warming');

-- ── 4. Opportunities — pipeline across every stage ──────────────────
-- Deterministic UUIDs: 0b000000-0000-4000-8000-0000000000NN.
INSERT INTO opportunities (
  id, agent_id, contact_id, opportunity_type, stage, title,
  deal_value, list_price, gci_estimated, gci_actual, commission_pct,
  property_address, property_city, property_state, property_zip, property_type,
  property_beds, property_baths, expected_close_date, actual_close_date,
  first_contact_date, confidence, priority, next_step_title, next_step_due_date,
  days_in_current_stage, outcome, lost_reason, last_activity_date,
  notes, created_at, updated_at
) VALUES
 ('0b000000-0000-4000-8000-000000000001','8e395af3-1a6a-4b6f-a689-e6ee65a77908','c0000000-0000-4000-8000-000000000011','buyer','conversation_active','Frodo Baggins — first-time buyer',320000,NULL,4800,NULL,3.0,NULL,'North Olmsted','OH','44070','single_family',3,2,(CURRENT_DATE+interval '95 days')::date,NULL,(CURRENT_DATE-interval '20 days')::date,'low',6,'Schedule buyer consultation',(CURRENT_DATE+interval '4 days')::date,3,NULL,NULL,now()-interval '3 days','Referred by Indiana Jones. Just starting — needs education on the process.',now()-interval '20 days',now()),
 ('0b000000-0000-4000-8000-000000000002','8e395af3-1a6a-4b6f-a689-e6ee65a77908','c0000000-0000-4000-8000-000000000006','seller','conversation_active','Sarah Connor — exploring a sale',410000,NULL,12300,NULL,3.0,'1984 Cyberdyne Ave','Parma','OH','44129','single_family',4,2.5,(CURRENT_DATE+interval '120 days')::date,NULL,(CURRENT_DATE-interval '45 days')::date,'low',5,'Send a home value estimate',(CURRENT_DATE+interval '6 days')::date,8,NULL,NULL,now()-interval '2 days','Timing uncertain — stays motivated once she commits.',now()-interval '45 days',now()),
 ('0b000000-0000-4000-8000-000000000003','8e395af3-1a6a-4b6f-a689-e6ee65a77908','c0000000-0000-4000-8000-00000000000e','buyer','opportunity_identified','Katniss Everdeen — move-up buyer',455000,NULL,6825,NULL,3.0,NULL,'Elyria','OH','44035','single_family',4,3,(CURRENT_DATE+interval '80 days')::date,NULL,(CURRENT_DATE-interval '55 days')::date,'medium',6,'Confirm pre-approval with lender',(CURRENT_DATE+interval '3 days')::date,11,NULL,NULL,now()-interval '9 days','Needs more space — growing household. Real buyer.',now()-interval '55 days',now()),
 ('0b000000-0000-4000-8000-000000000004','8e395af3-1a6a-4b6f-a689-e6ee65a77908','c0000000-0000-4000-8000-000000000010','seller','opportunity_identified','Walter White — cautious seller',365000,NULL,10950,NULL,3.0,'308 Negra Arroyo Lane','Brunswick','OH','44212','single_family',3,2,(CURRENT_DATE+interval '110 days')::date,NULL,(CURRENT_DATE-interval '60 days')::date,'low',4,'Email the listing prep checklist',(CURRENT_DATE+interval '7 days')::date,18,NULL,NULL,now()-interval '12 days','DNC — email/text only. Privacy-focused. Handle carefully.',now()-interval '60 days',now()),
 ('0b000000-0000-4000-8000-000000000005','8e395af3-1a6a-4b6f-a689-e6ee65a77908','c0000000-0000-4000-8000-000000000008','buyer','consultation_completed','Marty McFly — FHA starter home',285000,NULL,4275,NULL,3.0,NULL,'Strongsville','OH','44136','single_family',3,1.5,(CURRENT_DATE+interval '70 days')::date,NULL,(CURRENT_DATE-interval '70 days')::date,'medium',6,'Set up MLS auto-search',(CURRENT_DATE+interval '2 days')::date,9,NULL,NULL,now()-interval '6 days','Consultation done. Young buyer, FHA financing. Ready to tour.',now()-interval '70 days',now()),
 ('0b000000-0000-4000-8000-000000000006','8e395af3-1a6a-4b6f-a689-e6ee65a77908','c0000000-0000-4000-8000-00000000000c','seller','consultation_completed','Vito Corleone — family estate listing',1250000,NULL,37500,NULL,3.0,'Long Beach Compound','Mentor','OH','44060','single_family',6,5,(CURRENT_DATE+interval '90 days')::date,NULL,(CURRENT_DATE-interval '80 days')::date,'medium',7,'Follow up on listing decision',(CURRENT_DATE+interval '5 days')::date,14,NULL,NULL,now()-interval '7 days','Listing presentation done. Large family estate — decision pending with the family.',now()-interval '80 days',now()),
 ('0b000000-0000-4000-8000-000000000007','8e395af3-1a6a-4b6f-a689-e6ee65a77908','c0000000-0000-4000-8000-000000000003','buyer','client_secured','Hermione Granger — relocation buyer',520000,NULL,7800,NULL,3.0,NULL,'Shaker Heights','OH','44120','single_family',4,3,(CURRENT_DATE+interval '60 days')::date,NULL,(CURRENT_DATE-interval '90 days')::date,'high',7,'Begin showings this weekend',(CURRENT_DATE+interval '3 days')::date,6,NULL,NULL,now()-interval '5 days','Buyer rep agreement signed. Pre-approved, relocating for work. Sharp client.',now()-interval '90 days',now()),
 ('0b000000-0000-4000-8000-000000000008','8e395af3-1a6a-4b6f-a689-e6ee65a77908','c0000000-0000-4000-8000-00000000000b','buyer','active_opportunity','Luke Skywalker — touring actively',390000,NULL,5850,NULL,3.0,NULL,'Avon','OH','44011','single_family',3,2,(CURRENT_DATE+interval '45 days')::date,NULL,(CURRENT_DATE-interval '60 days')::date,'high',8,'Tour 3 homes Saturday',(CURRENT_DATE+interval '2 days')::date,12,NULL,NULL,now()-interval '1 days','Touring actively, financing ready. Close to writing an offer.',now()-interval '60 days',now()),
 ('0b000000-0000-4000-8000-000000000009','8e395af3-1a6a-4b6f-a689-e6ee65a77908','c0000000-0000-4000-8000-000000000004','seller','active_opportunity','Bruce Wayne — estate on market',2100000,2100000,63000,NULL,3.0,'1007 Mountain Drive','Cleveland Heights','OH','44106','single_family',7,8,(CURRENT_DATE+interval '50 days')::date,NULL,(CURRENT_DATE-interval '75 days')::date,'high',9,'Review first-week showing feedback',(CURRENT_DATE+interval '4 days')::date,9,NULL,NULL,now()-interval '6 days','Listed and live. High-value estate. Discreet seller — limited showings.',now()-interval '75 days',now()),
 ('0b000000-0000-4000-8000-00000000000a','8e395af3-1a6a-4b6f-a689-e6ee65a77908','c0000000-0000-4000-8000-000000000007','buyer','under_contract','James Bond — downtown condo',475000,485000,7125,NULL,3.0,'150 Euclid Ave, Unit 1107','Cleveland','OH','44115','condo',2,2,(CURRENT_DATE+interval '21 days')::date,NULL,(CURRENT_DATE-interval '95 days')::date,'high',9,'Confirm inspection results',(CURRENT_DATE+interval '3 days')::date,7,NULL,NULL,now()-interval '8 days','Offer accepted. Inspection scheduled. Smooth so far.',now()-interval '95 days',now()),
 ('0b000000-0000-4000-8000-00000000000b','8e395af3-1a6a-4b6f-a689-e6ee65a77908','c0000000-0000-4000-8000-000000000001','seller','closed','Tony Stark — lakefront sale (closed)',1850000,1895000,55500,55500,3.0,'10880 Malibu Point','Cleveland','OH','44114','single_family',5,6,(CURRENT_DATE-interval '14 days')::date,(CURRENT_DATE-interval '14 days')::date,(CURRENT_DATE-interval '160 days')::date,'high',5,NULL,NULL,5,'won',NULL,now()-interval '14 days','Closed two weeks ago. Best advocate in the sphere — refers constantly.',now()-interval '160 days',now()),
 ('0b000000-0000-4000-8000-00000000000c','8e395af3-1a6a-4b6f-a689-e6ee65a77908','c0000000-0000-4000-8000-000000000014','buyer','lost','Norman Bates — inquiry went cold',300000,NULL,4500,NULL,3.0,NULL,'Painesville','OH','44077','single_family',3,1,NULL,NULL,(CURRENT_DATE-interval '110 days')::date,'low',3,NULL,NULL,40,'lost','not_ready',now()-interval '95 days','Inquiry never warmed up. Not a fit right now — parked.',now()-interval '110 days',now()),
 ('0b000000-0000-4000-8000-00000000000d','8e395af3-1a6a-4b6f-a689-e6ee65a77908','c0000000-0000-4000-8000-000000000009','referral','opportunity_identified','Indiana Jones — referral out to Chicago',600000,NULL,4500,NULL,25.0,NULL,'Chicago','IL','60601','single_family',3,2,(CURRENT_DATE+interval '85 days')::date,NULL,(CURRENT_DATE-interval '30 days')::date,'medium',5,'Check in with the receiving agent',(CURRENT_DATE+interval '10 days')::date,12,NULL,NULL,now()-interval '15 days','Referred Indy''s colleague to a Chicago agent — 25% referral fee.',now()-interval '30 days',now());

-- ── 5. contact_activities — logged outreach history ─────────────────
-- All have a non-null outcome → they count as REAL touches (not
-- SphereSync stubs). Recent rows (rn<=8) land inside the current week
-- so the dashboard "sphere touches this week" KPI + History tab fill in.
INSERT INTO contact_activities (
  id, contact_id, agent_id, activity_type, activity_date, outcome,
  notes, duration_minutes, is_system_generated, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  c.id,
  '8e395af3-1a6a-4b6f-a689-e6ee65a77908',
  (ARRAY['call','text','email','meeting','call','text'])[1 + (c.rn % 6)],
  now() - ((CASE WHEN c.rn <= 8 THEN c.rn ELSE 8 + (c.rn - 8) * 4 END) || ' days')::interval,
  (ARRAY['connected','left_voicemail','replied','no_answer','met','sent'])[1 + (c.rn % 6)],
  'Demo: ' || (ARRAY[
     'Caught up on family and how the neighborhood is feeling.',
     'Checked in about the market and timing.',
     'Shared three new listings that fit what they mentioned.',
     'Quick hello — kept the relationship warm.',
     'Talked through next steps and answered questions.',
     'Followed up on our last conversation.'
   ])[1 + (c.rn % 6)],
  (ARRAY[12, 0, 0, 8, 25, 0])[1 + (c.rn % 6)],
  false,
  now(), now()
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
  FROM contacts
  WHERE agent_id = '8e395af3-1a6a-4b6f-a689-e6ee65a77908'
) c
WHERE c.rn <= 30;

-- ── 6. SphereSync tasks — current week ──────────────────────────────
-- week_number / year computed from CURRENT_DATE so re-runs re-anchor.
-- First 4 tasks completed (with completed_at this week) → History tab
-- + "touched this week" populate; the rest stay open.
INSERT INTO spheresync_tasks (
  id, task_type, lead_id, agent_id, week_number, year,
  completed, completed_at, source, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  CASE WHEN c.rn % 3 = 0 THEN 'text' ELSE 'call' END,
  c.id,
  '8e395af3-1a6a-4b6f-a689-e6ee65a77908',
  EXTRACT(week FROM CURRENT_DATE)::int,
  EXTRACT(isoyear FROM CURRENT_DATE)::int,
  (c.rn <= 4),
  CASE WHEN c.rn <= 4 THEN now() - ((c.rn) || ' days')::interval ELSE NULL END,
  'demo_seed',
  now(), now()
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
  FROM contacts
  WHERE agent_id = '8e395af3-1a6a-4b6f-a689-e6ee65a77908'
) c
WHERE c.rn <= 12;

-- ── 7. Coaching submissions — 8 weeks of Scoreboard history ─────────
-- Computed relative to the current ISO week so the streak always shows
-- 8 consecutive completed weeks ending last Sunday. Numbers trend up
-- toward recent weeks (a believable "agent finding momentum" story).
INSERT INTO coaching_submissions (
  id, agent_id, week_ending, week_number, year,
  leads_contacted, appointments_set, deals_closed,
  conversations, dials_made, appointments_held, agreements_signed,
  offers_made_accepted, closings, closing_amount, database_size,
  energy_rating, focus_rating, confidence_rating,
  must_do_task, challenges, coaching_notes, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  '8e395af3-1a6a-4b6f-a689-e6ee65a77908',
  (date_trunc('week', CURRENT_DATE) - ((n) || ' weeks')::interval - interval '1 day')::date,
  EXTRACT(week FROM CURRENT_DATE)::int - n,
  EXTRACT(isoyear FROM CURRENT_DATE)::int,
  30 - n,                                  -- leads_contacted
  GREATEST(1, 6 - (n / 2)),                -- appointments_set
  CASE WHEN n IN (1,4,7) THEN 1 ELSE 0 END,-- deals_closed
  28 - n,                                  -- conversations
  55 - n * 2,                              -- dials_made
  GREATEST(1, 5 - (n / 2)),                -- appointments_held
  CASE WHEN n IN (2,5) THEN 1 ELSE 0 END,  -- agreements_signed
  CASE WHEN n IN (1,4,7) THEN 1 ELSE 0 END,-- offers_made_accepted
  CASE WHEN n IN (1,4,7) THEN 1 ELSE 0 END,-- closings
  CASE WHEN n IN (1,4,7) THEN 9500 ELSE 0 END, -- closing_amount (GCI)
  330 + (8 - n) * 3,                       -- database_size (growing)
  3 + (n % 3),                             -- energy_rating 3-5
  3 + ((n + 1) % 3),                       -- focus_rating 3-5
  3 + ((n + 2) % 3),                       -- confidence_rating 3-5
  (ARRAY[
     'Call every contact in this week''s rotation before Friday.',
     'Finish the Corleone listing follow-up.',
     'Book two buyer consultations.',
     'Get Skywalker out touring this weekend.',
     'Send value estimates to the seller leads.',
     'Reconnect with five dormant sphere contacts.',
     'Prep the Wayne estate showing feedback summary.',
     'Lock in the Bond inspection timeline.'
   ])[n],
  (ARRAY[
     'Hard to reach a few contacts — playing phone tag.',
     'Balancing showings with prospecting time.',
     'Two leads went quiet this week.',
     'Needed to tighten up follow-up speed.',
     'Calendar got crowded mid-week.',
     'Slow start Monday, recovered by Wednesday.',
     'Juggling the estate listing prep.',
     'Getting back into rhythm after the holiday week.'
   ])[n],
  'Steady week. SphereSync rotation kept the pipeline fed.',
  now() - ((n) || ' weeks')::interval,
  now()
FROM generate_series(1, 8) AS n;

-- ── 8. Growth goals — qualitative Scoreboard goals ──────────────────
INSERT INTO agent_growth_goals (
  id, agent_id, title, description, target_value, current_value, unit,
  target_date, status, sort_order, bar_color_token, created_at, updated_at
) VALUES
 (gen_random_uuid(),'8e395af3-1a6a-4b6f-a689-e6ee65a77908','Close 24 transactions this year','Stay on pace with two closings a month across buyers and sellers.',24,9,'closings',(date_trunc('year',CURRENT_DATE)+interval '1 year'-interval '1 day')::date,'active',1,'reop-teal',now(),now()),
 (gen_random_uuid(),'8e395af3-1a6a-4b6f-a689-e6ee65a77908','1,200 sphere conversations','Hit 25 real conversations a week through the SphereSync rotation.',1200,468,'conversations',(date_trunc('year',CURRENT_DATE)+interval '1 year'-interval '1 day')::date,'active',2,'reop-green',now(),now()),
 (gen_random_uuid(),'8e395af3-1a6a-4b6f-a689-e6ee65a77908','Grow the database to 400','Add new sphere contacts steadily — referrals and event leads.',400,360,'contacts',(date_trunc('year',CURRENT_DATE)+interval '1 year'-interval '1 day')::date,'active',3,'reop-dark-blue',now(),now()),
 (gen_random_uuid(),'8e395af3-1a6a-4b6f-a689-e6ee65a77908','Host 4 client events','One client appreciation event per quarter.',4,1,'events',(date_trunc('year',CURRENT_DATE)+interval '1 year'-interval '1 day')::date,'active',4,'reop-warm',now(),now());

-- ── 9. Event + RSVPs ────────────────────────────────────────────────
INSERT INTO events (
  id, title, description, event_date, location, event_type, agent_id,
  created_by, theme, max_capacity, current_rsvp_count, invited_count,
  is_published, public_slug, auto_followup_enabled, followup_1_days,
  followup_2_days, registration_info, created_at, updated_at
) VALUES (
  'e0000000-0000-4000-8000-000000000001',
  'Summer Client Appreciation — Backyard BBQ',
  'Our annual thank-you to the Rivera Property Group sphere. Food, music, and a market update you can actually use. Bring the family.',
  (CURRENT_DATE + interval '12 days' + interval '17 hours')::timestamptz,
  'Edgewater Park Pavilion, Cleveland, OH',
  'client_appreciation',
  '8e395af3-1a6a-4b6f-a689-e6ee65a77908',
  '8e395af3-1a6a-4b6f-a689-e6ee65a77908',
  'Summer BBQ',
  60, 9, 36, true, 'rivera-summer-bbq-demo',
  true, 3, 7,
  'Free to attend — RSVP so we know how much barbecue to order.',
  now() - interval '20 days', now()
);

INSERT INTO event_rsvps (
  id, event_id, name, email, phone, guest_count, status,
  rsvp_date, check_in_status, created_at, updated_at
) VALUES
 (gen_random_uuid(),'e0000000-0000-4000-8000-000000000001','Tony Stark','tony.stark@demo.reop','(216) 555-0201',2,'confirmed',now()-interval '14 days','not_checked_in',now(),now()),
 (gen_random_uuid(),'e0000000-0000-4000-8000-000000000001','Harry Potter','harry.potter@demo.reop','(216) 555-0202',1,'confirmed',now()-interval '13 days','not_checked_in',now(),now()),
 (gen_random_uuid(),'e0000000-0000-4000-8000-000000000001','Leia Organa','leia.organa@demo.reop','(216) 555-0210',3,'confirmed',now()-interval '12 days','not_checked_in',now(),now()),
 (gen_random_uuid(),'e0000000-0000-4000-8000-000000000001','Han Solo','han.solo@demo.reop','(216) 555-0219',2,'confirmed',now()-interval '12 days','not_checked_in',now(),now()),
 (gen_random_uuid(),'e0000000-0000-4000-8000-000000000001','Forrest Gump','forrest.gump@demo.reop','(216) 555-0213',1,'confirmed',now()-interval '10 days','not_checked_in',now(),now()),
 (gen_random_uuid(),'e0000000-0000-4000-8000-000000000001','Sherlock Holmes','sherlock.holmes@demo.reop','(216) 555-0230',1,'confirmed',now()-interval '9 days','not_checked_in',now(),now()),
 (gen_random_uuid(),'e0000000-0000-4000-8000-000000000001','Indiana Jones','indy.jones@demo.reop','(216) 555-0209',2,'confirmed',now()-interval '8 days','not_checked_in',now(),now()),
 (gen_random_uuid(),'e0000000-0000-4000-8000-000000000001','Dorothy Gale','dorothy.gale@demo.reop','(216) 555-0221',4,'confirmed',now()-interval '6 days','not_checked_in',now(),now()),
 (gen_random_uuid(),'e0000000-0000-4000-8000-000000000001','Elle Woods','elle.woods@demo.reop','(216) 555-0227',1,'waitlist',now()-interval '3 days','not_checked_in',now(),now());

-- ── 10. Reflect pipeline membership onto contacts ───────────────────
-- Mark contacts that have an active (non-closed/lost) opportunity so
-- the SphereSync contact drawer + Database surfaces show it. A DB
-- trigger may already do this; the explicit UPDATE is belt + suspenders.
UPDATE contacts c SET
  pipeline_active = EXISTS (
    SELECT 1 FROM opportunities o
    WHERE o.contact_id = c.id
      AND o.stage IS NOT NULL
      AND o.stage NOT IN ('closed','lost')
  ),
  last_pipeline_activity = (
    SELECT max(o.last_activity_date) FROM opportunities o WHERE o.contact_id = c.id
  )
WHERE c.agent_id = '8e395af3-1a6a-4b6f-a689-e6ee65a77908';

COMMIT;
