import { Router, Request, Response } from 'express';

type LabRequestRecord = {
    projectId: string;
    personId?: string | null;
    startDate: string;
    endDate: string;
    billablePercent: number;
    billableType: 'Billable' | 'Opportunity';
    status?: 'Pending' | 'Approved' | 'Rejected';
    requiredSkill?: string | null;
    notes?: string | null;
};

type LabCreateRequestsBody = {
    payload: LabRequestRecord[];
};

type InsertedRequestRow = {
    id: string;
    project_id: string;
    person_id: string | null;
    start_date: string;
    end_date: string;
    billable_percent: number;
    billable_type: 'Billable' | 'Opportunity';
};

const router = Router();

const postgrestUrl = process.env.POSTGREST_URL || 'http://localhost:4001';
const postgrestJwt = process.env.POSTGREST_JWT || '';

router.post('/requests', async (req: Request, res: Response) => {
    const { payload = [] } = req.body as LabCreateRequestsBody;

    try {
        const headers = new Headers({
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
        });

        if (postgrestJwt) {
            headers.set('Authorization', `Bearer ${postgrestJwt}`);
        }

        const response = await fetch(`${postgrestUrl}/request`, {
            method: 'POST',
            headers,
            body: JSON.stringify(
                payload.map((row) => ({
                    project_id: row.projectId,
                    person_id: row.personId ?? null,
                    start_date: row.startDate,
                    end_date: row.endDate,
                    billable_percent: row.billablePercent,
                    billable_type: row.billableType,
                    status: row.status ?? 'Pending',
                    required_skill: row.requiredSkill ?? null,
                    notes: row.notes ?? null,
                }))
            ),
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const rows = (await response.json()) as InsertedRequestRow[];

        return res.status(201).json({
            message: 'Requests created successfully.',
            insertedCount: rows.length,
            data: rows,
        });
    } catch (err) {
        console.error('Failed to create requests via lab API:', err);
        return res.status(500).json({ error: 'Failed to create requests.' });
    }
});

export default router;