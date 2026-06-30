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
    const { student_name, device_identifier } = await req.json()

    if (!student_name || !device_identifier) {
      return new Response(JSON.stringify({ success: false, reason: 'MISSING_FIELDS' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: students, error: lookupError } = await supabase
      .from('students')
      .select('id')
      .ilike('name', student_name.trim())
      .limit(2)

    if (lookupError || !students || students.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        reason: 'STUDENT_NOT_FOUND',
        message: 'Name not found. Contact your teacher to be added.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (students.length > 1) {
      return new Response(JSON.stringify({
        success: false,
        reason: 'AMBIGUOUS_NAME',
        message: 'Multiple students found with that name. Teacher must register your device.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const studentId = students[0].id

    const { data: existingDevice } = await supabase
      .from('devices')
      .select('id, active')
      .eq('student_id', studentId)
      .eq('active', true)
      .maybeSingle()

    const { data: existingPending } = await supabase
      .from('device_change_requests')
      .select('id')
      .eq('student_id', studentId)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingPending) {
      return new Response(JSON.stringify({
        success: false,
        reason: 'PENDING_EXISTS',
        message: 'You already have a pending registration request.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: insertError } = await supabase
      .from('device_change_requests')
      .insert({
        student_id: studentId,
        old_device_id: existingDevice?.id ?? null,
        new_device_identifier: device_identifier,
        status: 'pending',
      })

    if (insertError) {
      return new Response(JSON.stringify({ success: false, reason: 'SERVER_ERROR' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      reason: null,
      message: 'Registration request submitted. Ask your teacher to approve it.',
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
