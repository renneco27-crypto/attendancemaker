import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { student_name, device_identifier, pin } = await req.json()

    if (!student_name || !device_identifier || !pin || pin.length !== 4) {
      return new Response(JSON.stringify({ success: false, reason: 'MISSING_FIELDS' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: registrations, error: lookupError } = await supabase
      .from('device_registrations')
      .select('id, student_name')
      .eq('status', 'pending')
      .eq('device_identifier', '')
      .ilike('student_name', student_name.trim())
      .limit(2)

    if (lookupError || !registrations || registrations.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        reason: 'STUDENT_NOT_FOUND',
        message: 'Name not found. Make sure your teacher added you to the system first.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (registrations.length > 1) {
      return new Response(JSON.stringify({
        success: false,
        reason: 'AMBIGUOUS_NAME',
        message: 'Multiple students found with that name. Ask your teacher to register you.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const reg = registrations[0]

    // Revoke any existing approved device for this student
    const { data: existingApproved } = await supabase
      .from('device_registrations')
      .select('id')
      .eq('student_id', reg.student_id)
      .eq('status', 'approved')
      .maybeSingle()

    if (existingApproved) {
      await supabase
        .from('device_registrations')
        .update({ status: 'revoked' })
        .eq('id', existingApproved.id)
    }

    const { error: updateError } = await supabase
      .from('device_registrations')
      .update({ device_identifier, pin })
      .eq('id', reg.id)

    if (updateError) {
      return new Response(JSON.stringify({ success: false, reason: 'SERVER_ERROR' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      reason: null,
      message: 'Device registered! Ask your teacher to approve it.',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ success: false, reason: 'SERVER_ERROR' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
