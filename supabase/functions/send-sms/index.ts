import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { to, message } = await req.json()

    // Format number to +254... if it starts with 0
    let formattedTo = to.trim()
    if (formattedTo.startsWith('0')) {
      formattedTo = '+254' + formattedTo.substring(1)
    }

    const username = Deno.env.get('AT_USERNAME')
    const apiKey = Deno.env.get('AT_API_KEY')

    // Use sandbox endpoint when username is 'sandbox'
    const isSandbox = username === 'sandbox'
    const apiUrl = isSandbox
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging'

    const formData = new URLSearchParams()
    formData.append('username', username!)
    formData.append('to', formattedTo)
    formData.append('message', message)

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'apiKey': apiKey!
      },
      body: formData.toString()
    })

    const result = await response.json()

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})