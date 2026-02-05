import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const TEAM_ID = '9011620633'; // Real Estate on Purpose

interface ClickUpList {
  id: string;
  name: string;
  folder?: { id: string; name: string };
}

interface ClickUpFolder {
  id: string;
  name: string;
  lists: ClickUpList[];
}

interface ClickUpSpace {
  id: string;
  name: string;
  folders: ClickUpFolder[];
  folderlessLists: ClickUpList[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const clickupApiToken = Deno.env.get('CLICKUP_API_TOKEN');
    
    if (!clickupApiToken) {
      return new Response(
        JSON.stringify({ error: 'CLICKUP_API_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      'Authorization': clickupApiToken,
      'Content-Type': 'application/json',
    };

    console.log(`Fetching spaces for team ${TEAM_ID}...`);

    // 1. Get all spaces
    const spacesResponse = await fetch(`https://api.clickup.com/api/v2/team/${TEAM_ID}/space`, {
      headers,
    });

    if (!spacesResponse.ok) {
      const errorText = await spacesResponse.text();
      console.error('Failed to fetch spaces:', spacesResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch spaces', details: errorText }),
        { status: spacesResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const spacesData = await spacesResponse.json();
    console.log(`Found ${spacesData.spaces?.length || 0} spaces`);

    const workspaceStructure: ClickUpSpace[] = [];

    // 2. For each space, get folders and lists
    for (const space of spacesData.spaces || []) {
      console.log(`Processing space: ${space.name} (ID: ${space.id})`);
      
      const spaceResult: ClickUpSpace = {
        id: space.id,
        name: space.name,
        folders: [],
        folderlessLists: [],
      };

      // Get folders in this space
      const foldersResponse = await fetch(`https://api.clickup.com/api/v2/space/${space.id}/folder`, {
        headers,
      });

      if (foldersResponse.ok) {
        const foldersData = await foldersResponse.json();
        
        for (const folder of foldersData.folders || []) {
          console.log(`  Processing folder: ${folder.name} (ID: ${folder.id})`);
          
          const folderResult: ClickUpFolder = {
            id: folder.id,
            name: folder.name,
            lists: [],
          };

          // Get lists in this folder
          const listsResponse = await fetch(`https://api.clickup.com/api/v2/folder/${folder.id}/list`, {
            headers,
          });

          if (listsResponse.ok) {
            const listsData = await listsResponse.json();
            
            for (const list of listsData.lists || []) {
              console.log(`    Found list: ${list.name} (ID: ${list.id})`);
              folderResult.lists.push({
                id: list.id,
                name: list.name,
              });
            }
          }

          spaceResult.folders.push(folderResult);
        }
      }

      // Get folderless lists in this space
      const folderlessResponse = await fetch(`https://api.clickup.com/api/v2/space/${space.id}/list`, {
        headers,
      });

      if (folderlessResponse.ok) {
        const folderlessData = await folderlessResponse.json();
        
        for (const list of folderlessData.lists || []) {
          console.log(`  Found folderless list: ${list.name} (ID: ${list.id})`);
          spaceResult.folderlessLists.push({
            id: list.id,
            name: list.name,
          });
        }
      }

      workspaceStructure.push(spaceResult);
    }

    // Create a formatted text version for easy reading
    let formattedOutput = `\n=== ClickUp Workspace Structure ===\n`;
    formattedOutput += `Team: Real Estate on Purpose (${TEAM_ID})\n\n`;

    for (const space of workspaceStructure) {
      formattedOutput += `📁 SPACE: ${space.name} (ID: ${space.id})\n`;
      
      for (const folder of space.folders) {
        formattedOutput += `  📂 FOLDER: ${folder.name} (ID: ${folder.id})\n`;
        
        for (const list of folder.lists) {
          formattedOutput += `    📋 LIST: ${list.name} (ID: ${list.id})\n`;
        }
      }
      
      if (space.folderlessLists.length > 0) {
        formattedOutput += `  📋 FOLDERLESS LISTS:\n`;
        for (const list of space.folderlessLists) {
          formattedOutput += `    📋 ${list.name} (ID: ${list.id})\n`;
        }
      }
      
      formattedOutput += `\n`;
    }

    console.log(formattedOutput);

    return new Response(
      JSON.stringify({
        success: true,
        team_id: TEAM_ID,
        team_name: 'Real Estate on Purpose',
        structure: workspaceStructure,
        formatted: formattedOutput,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching workspace structure:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
