| ID | Scenario | Covers | Process instance | Result |
|---|---|---|---|---|
| TC01 | Happy path: registration, nearest nurse, 7 sequential visits, parallel physio, pharmacy call activity, completion | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 18 | 2251799813864477 | PASS |
| TC02 | High pain score -> ELEVATED -> Readmission Risk Intervention -> doctor review with non-interrupting reminder timer | 11, 13, 15 | 2251799813849561 | PASS |
| TC03 | Infection indicators (wound discharge + fever) -> CRITICAL -> urgent response + SMS critical alert | 12, 13 | 2251799813850689 | PASS |
| TC04 | Error boundary: urgent-response dispatch fails -> EMERGENCY_DISPATCH_FAILED caught on the sub-process -> manual coordination | 14 | 2251799813851730 | PASS |
| TC05 | Interrupting timer boundaries: missed visits and missed physiotherapy -> plan COMPLETED_WITH_GAPS -> coordinator gap review | 15, 18 | 2251799813852773 | PASS |
| TC06 | External API failure: Distance Matrix OVER_QUERY_LIMIT -> DISTANCE_API_ERROR boundary -> straight-line fallback | 16, 14 | 2251799813853794 | PASS |
| TC07 | No suitable nurse: every nurse beyond the travel limit -> NO_SUITABLE_NURSE -> manual assignment | 3, 14 | 2251799813855804 | PASS |
| TC08 | Nurse pool empty -> timer retry loop (3 attempts) -> manual assignment | 3, 15 | 2251799813856802 | PASS |
| TC09 | Notification failure: SMTP down -> SMS fallback; SMS rejected too -> failure recorded, care continues | 17 | 2251799813857894 | PASS |
| TC10 | Pharmacy: rejected (controlled, no approval), partner pharmacy, unavailable, delayed-delivery reminder | 8, 9, 10 | 2251799813858889 | PASS |
| TC11 | Courier unavailable -> COURIER_UNAVAILABLE boundary in the child process -> delivery DELAYED | 9, 10, 14 | 2251799813860052 | PASS |
| TC12 | Invalid discharge (date 20 days old) -> coordinator corrects details -> validation passes | 1, 2 | 2251799813861041 | PASS |
| TC13 | Doctor decides READMIT -> hospital readmission arranged | 13 | 2251799813862172 | PASS |
| TC14 | Interrupting timer on the Readmission Risk sub-process: no doctor decision in time -> clinical lead escalation | 13, 15 | 2251799813863234 | PASS |
| TC15 | External API failure: Distance Matrix HTTP 500 -> connector errorExpression -> DISTANCE_API_ERROR boundary on the REST task | 16, 14 | 2251799813854823 | PASS |
