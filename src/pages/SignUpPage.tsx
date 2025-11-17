

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import Jornada360Logo from '../components/ui/Jornada360Logo';

const SignUpPage: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    