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
    const { session_id, rotation_key, student_device_id, pin } = await req.json()

    if (!session_id || !rotation_key || !student_device_id || pin === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Look up session
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('id, teacher_id, rotation_key, is_active, expires_at')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!session.is_active) {
      return new Response(JSON.stringify({ error: 'Session has ended' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Session expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Check rotation key
    if (session.rotation_key !== rotation_key) {
      return new Response(JSON.stringify({ error: 'QR code expired, please rescan' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Look up device registration
    const { data: deviceReg, error: deviceError } = await supabase
      .from('device_registrations')
      .select('id, student_id, student_name, status')
      .eq('device_identifier', student_device_id)
      .eq('teacher_id', session.teacher_id)
      .single()

    if (deviceError || !deviceReg) {
      return new Response(JSON.stringify({ error: 'Device not registered' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (deviceReg.status !== 'approved') {
      return new Response(JSON.stringify({ error: 'Device not approved' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Check PIN
    const expectedPin = Deno.env.get('ATTENDANCE_PIN') ?? '1234'
    if (pin !== expectedPin) {
      return new Response(JSON.stringify({ error: 'Incorrect PIN' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Check duplicate attendance
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('session_id', session_id)
      .eq('student_id', deviceReg.student_id)
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ error: 'Already checked in' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. Insert attendance record
    const { error: insertError } = await supabase
      .from('attendance_records')
      .insert({
        session_id,
        student_id: deviceReg.student_id,
        scanned_at: new Date().toISOString(),
      })

    if (insertError) {
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, student_name: deviceReg.student_name }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
