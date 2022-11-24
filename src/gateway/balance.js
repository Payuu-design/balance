import pool from '../services/db.js';
import fetch from '../helpers/fetch.js';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { readMany } from '../helpers/crud.js'
import { WESTERN_BANK_API_ENDPOINT, EAST_BANK_API_ENDPOINT } from '../config/index.config.js';
import { cardIsWestern, parseOwnerName, validateCardNumbers } from '../helpers/utils.js';

const router = new Router();

router.use('/', async function (req, res) {
    const { user_id } = req.body;
    if(!user_id) return res.status(400).json({ message: 'Missing user_id' });
    
    let cards; // userCards will be the cards that the user has from now on
    try {
        cards = await readMany(
            'payment_method',
            { 'payment_method': ['card_number', 'owner', 'card_type_id'] },
            [],
            { 'user_id': user_id },
            null, null, pool
        );
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
    
    const promises = cards.map(card => {
        const endpoint = cardIsWestern(card.card_type_id) ? WESTERN_BANK_API_ENDPOINT : EAST_BANK_API_ENDPOINT;

        return fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { card }
        });
    });

    let responses;
    try {
        responses = await Promise.allSettled(promises);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
    console.log(responses);
    
    let balances = [];
    for (let i = 0; i < responses.length; i++) {
        if (responses[i].value.status !== 200) {
            // return res.status(responses[i].value.status).json({ message: responses[i].value.data.message });
            balances.push({ card_number: cards[i].card_number, balance: 0 });
        }
        console.log(responses[i].value.data);
        const { balance } = responses[i].value.data;
        balances.push({ card_number: cards[i].card_number, balance });
    }
    
    res.status(200).json(balances);
});

export default router;
