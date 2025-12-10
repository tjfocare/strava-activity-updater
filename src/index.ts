
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    console.log('Received request:', request.method, url.pathname);

    // Webhook verification
    if (request.method === 'GET') {
      const challenge = url.searchParams.get('hub.challenge');
      const verify_token = url.searchParams.get('hub.verify_token');
      console.log('Webhook verification:', { challenge, verify_token });

      if (verify_token === env.VERIFY_TOKEN) {
        return new Response(JSON.stringify({ 'hub.challenge': challenge }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('Invalid verify token', { status: 403 });
    }

    // Handle webhook events
    const event = await request.json() as Record<string, any>;
    console.log('Webhook event:', JSON.stringify(event, null, 2));

    if (event.object_type === 'activity' && event.aspect_type === 'create') {
      console.log('Processing activity:', event.object_id);
      await handleActivity(event.object_id, env);
    }

    return new Response('OK', { status: 200 });
  }
};

async function handleActivity(activityId: string, env: Env) {
  console.log('Refreshing access token...');
  const accessToken = await refreshAccessToken(env);

  console.log('Fetching activity:', activityId);
  const activity = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }).then(r => r.json()) as Record<string, any>;

  console.log('Activity type:', activity.type, 'Name:', activity.name);
  console.log(JSON.stringify(activity, null, 2))

  if (activity.type !== 'Run') {
    console.log('Hiding activity (not a run)');
    await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ private: true, hide_from_home: true })
    });
    console.log('Activity hidden successfully');
  } else {
    console.log('Activity is a run, keeping visible');
  }
}

async function refreshAccessToken(env: Env) {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.CLIENT_ID,
      client_secret: env.CLIENT_SECRET,
      refresh_token: env.REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json() as Record<string, any>;
  console.log('Access token refreshed');
  return data.access_token;
}
