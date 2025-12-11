/**
 * Diagnostic script to check why Pam O'Bryant isn't receiving emails
 * 
 * This script checks:
 * 1. Pam's profile and email address
 * 2. Whether Pam has SphereSync tasks assigned
 * 3. Email logs for Pam
 * 4. Other potential issues
 * 
 * Run this with: deno run --allow-net --allow-env diagnose-pam-email.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Diagnosing email issues for Pam O\'Bryant...\n');

async function diagnosePamEmail() {
  try {
    // Step 1: Find Pam's profile
    console.log('📋 Step 1: Looking for Pam O\'Bryant\'s profile...');
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, first_name, last_name, role')
      .or('first_name.ilike.%Pam%,last_name.ilike.%O\'Bryant%,last_name.ilike.%OBryant%');

    if (profileError) {
      console.error('❌ Error fetching profiles:', profileError);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log('❌ No profile found for Pam O\'Bryant');
      console.log('   This could mean:');
      console.log('   - Pam hasn\'t been added to the system');
      console.log('   - Name spelling is different');
      console.log('   - Profile doesn\'t exist');
      return;
    }

    console.log(`✅ Found ${profiles.length} matching profile(s):`);
    profiles.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`      User ID: ${p.user_id}`);
      console.log(`      Email: ${p.email || '❌ NO EMAIL ADDRESS'}`);
      console.log(`      Role: ${p.role}`);
      console.log('');
    });

    // Step 2: Check each profile for tasks and email logs
    for (const profile of profiles) {
      if (!profile.email) {
        console.log(`⚠️  Profile ${profile.first_name} ${profile.last_name} has NO EMAIL ADDRESS`);
        console.log('   This is why emails aren\'t being sent!\n');
        continue;
      }

      console.log(`\n📊 Checking profile: ${profile.first_name} ${profile.last_name} (${profile.user_id})`);
      
      // Check current week tasks
      const currentWeek = getCurrentWeekNumber();
      const currentYear = new Date().getFullYear();
      
      console.log(`\n   📅 Current Week: ${currentWeek}, Year: ${currentYear}`);
      
      const { data: tasks, error: tasksError } = await supabase
        .from('spheresync_tasks')
        .select('id, task_type, week_number, year, completed, created_at')
        .eq('agent_id', profile.user_id)
        .eq('week_number', currentWeek)
        .eq('year', currentYear);

      if (tasksError) {
        console.error(`   ❌ Error fetching tasks:`, tasksError);
      } else {
        console.log(`   ✅ Found ${tasks?.length || 0} tasks for current week`);
        if (tasks && tasks.length > 0) {
          const callTasks = tasks.filter(t => t.task_type === 'call').length;
          const textTasks = tasks.filter(t => t.task_type === 'text').length;
          const completed = tasks.filter(t => t.completed).length;
          console.log(`      - Call tasks: ${callTasks}`);
          console.log(`      - Text tasks: ${textTasks}`);
          console.log(`      - Completed: ${completed}/${tasks.length}`);
        } else {
          console.log(`   ⚠️  NO TASKS FOUND for current week`);
          console.log(`      This means Pam won't receive SphereSync emails because:`);
          console.log(`      - The email function only sends to agents WITH tasks`);
          console.log(`      - Pam needs tasks assigned to receive emails`);
        }
      }

      // Check email logs
      console.log(`\n   📧 Checking email logs...`);
      const { data: emailLogs, error: logsError } = await supabase
        .from('spheresync_email_logs')
        .select('id, week_number, year, sent_at, task_count')
        .eq('agent_id', profile.user_id)
        .order('sent_at', { ascending: false })
        .limit(10);

      if (logsError) {
        console.error(`   ❌ Error fetching email logs:`, logsError);
      } else {
        console.log(`   ✅ Found ${emailLogs?.length || 0} email log entries`);
        if (emailLogs && emailLogs.length > 0) {
          console.log(`   Recent email sends:`);
          emailLogs.forEach(log => {
            const isCurrentWeek = log.week_number === currentWeek && log.year === currentYear;
            console.log(`      - Week ${log.week_number}/${log.year}: ${log.sent_at} (${log.task_count} tasks) ${isCurrentWeek ? '← CURRENT WEEK' : ''}`);
          });
        } else {
          console.log(`   ⚠️  NO EMAIL LOGS FOUND`);
          console.log(`      This means no emails have been sent to Pam yet`);
        }
      }

      // Check if email was skipped for current week
      if (tasks && tasks.length > 0) {
        const { data: currentWeekLog } = await supabase
          .from('spheresync_email_logs')
          .select('sent_at')
          .eq('agent_id', profile.user_id)
          .eq('week_number', currentWeek)
          .eq('year', currentYear)
          .maybeSingle();

        if (currentWeekLog) {
          console.log(`\n   ✅ Email WAS sent for current week at: ${currentWeekLog.sent_at}`);
        } else {
          console.log(`\n   ⚠️  Email NOT sent for current week (even though tasks exist)`);
          console.log(`      Possible reasons:`);
          console.log(`      - Email function hasn't run yet`);
          console.log(`      - Email sending failed`);
          console.log(`      - Email was filtered out`);
        }
      }

      // Check contacts
      console.log(`\n   👥 Checking contacts...`);
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, category, dnc')
        .eq('agent_id', profile.user_id)
        .limit(5);

      if (contactsError) {
        console.error(`   ❌ Error fetching contacts:`, contactsError);
      } else {
        console.log(`   ✅ Found ${contacts?.length || 0} contacts (showing first 5)`);
        if (contacts && contacts.length > 0) {
          contacts.forEach(c => {
            console.log(`      - ${c.first_name || ''} ${c.last_name} (Category: ${c.category}, DNC: ${c.dnc ? 'YES' : 'NO'})`);
          });
        }
      }
    }

    // Step 3: Check other email functions
    console.log(`\n\n📬 Checking other email systems...`);
    
    // Check coaching reminders
    const { data: coachingSubmissions } = await supabase
      .from('coaching_submissions')
      .select('week_number, year, submitted_at')
      .in('agent_id', profiles.map(p => p.user_id))
      .order('submitted_at', { ascending: false })
      .limit(5);

    console.log(`   📝 Coaching submissions: ${coachingSubmissions?.length || 0} found`);
    
    // Summary
    console.log(`\n\n📋 SUMMARY:`);
    console.log(`   Found ${profiles.length} profile(s) matching "Pam O'Bryant"`);
    profiles.forEach(p => {
      console.log(`\n   ${p.first_name} ${p.last_name}:`);
      console.log(`      Email: ${p.email || '❌ MISSING'}`);
      if (!p.email) {
        console.log(`      ⚠️  PRIMARY ISSUE: No email address in profile`);
      }
    });

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  }
}

function getCurrentWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const startDay = start.getDay();
  const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const adjustedDays = daysSinceStart + (startDay === 0 ? 6 : startDay - 1);
  const weekNumber = Math.ceil((adjustedDays + 1) / 7);
  return Math.min(Math.max(weekNumber, 1), 52);
}

diagnosePamEmail();

