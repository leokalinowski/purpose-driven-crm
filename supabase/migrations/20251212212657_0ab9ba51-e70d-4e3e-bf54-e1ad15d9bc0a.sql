-- Delete orphaned coaching submissions for deleted user Armon
DELETE FROM coaching_submissions 
WHERE agent_id = '4ece7743-0a28-4836-a5ba-d03c67622bb7';

-- Also delete any orphaned profile record if it exists
DELETE FROM profiles 
WHERE user_id = '4ece7743-0a28-4836-a5ba-d03c67622bb7';