| ID | Scenario | Covers | Process instance | Result |
|---|---|---|---|---|
| TC01 | Happy path: registration, nearest nurse, 7 sequential visits, parallel physio, pharmacy call activity, completion | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 18 | 2251799814119230 | PASS |
| TC02 | High pain score -> ELEVATED -> Readmission Risk Intervention -> doctor review with non-interrupting reminder timer | 11, 13, 15 | 2251799814100262 | PASS |
| TC03 | Infection indicators (wound discharge + fever) -> CRITICAL -> urgent response + SMS critical alert | 12, 13 | 2251799814101447 | PASS |
| TC04 | Error boundary: urgent-response dispatch fails -> EMERGENCY_DISPATCH_FAILED caught on the sub-process -> manual coordination | 14 | 2251799814102537 | PASS |
| TC05 | Interrupting timer boundaries: missed visits and missed physiotherapy -> plan COMPLETED_WITH_GAPS -> coordinator gap review | 15, 18 | 2251799814103632 | PASS |
| TC06 | External API failure: Distance Matrix OVER_QUERY_LIMIT -> DISTANCE_API_ERROR boundary -> straight-line fallback | 16, 14 | 2251799814104660 | PASS |
| TC07 | No suitable nurse: every nurse beyond the travel limit -> NO_SUITABLE_NURSE -> manual assignment | 3, 14 | 2251799814106713 | PASS |
| TC08 | Nurse pool empty -> timer retry loop (3 attempts) -> manual assignment | 3, 15 | 2251799814107734 | PASS |
| TC09 | Notification failure: SMTP down -> SMS fallback; SMS rejected too -> failure recorded, care continues | 17 | 2251799814108778 | PASS |
| TC10 | Pharmacy: rejected (controlled, no approval), partner pharmacy, unavailable, delayed-delivery reminder | 8, 9, 10 | 2251799814109824 | PASS |
| TC11 | Courier unavailable -> COURIER_UNAVAILABLE boundary in the child process -> delivery DELAYED | 9, 10, 14 | 2251799814111027 | PASS |
| TC12 | Invalid discharge (date 20 days old) -> coordinator corrects details -> validation passes | 1, 2 | 2251799814112033 | PASS |
| TC13 | Doctor decides READMIT -> hospital readmission arranged | 13 | 2251799814113093 | PASS |
| TC14 | Interrupting timer on the Readmission Risk sub-process: no doctor decision in time -> clinical lead escalation | 13, 15 | 2251799814114196 | PASS |
| TC15 | External API failure: Distance Matrix HTTP 500 -> connector errorExpression -> DISTANCE_API_ERROR boundary on the REST task | 16, 14 | 2251799814117023 | PASS |
