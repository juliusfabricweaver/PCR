# PCR Form Inputs

## Basic Information
1. **Date** - `date` (date input) **[REQUIRED]**
2. **Location** - `location` (text input) **[REQUIRED]**
3. **Call Number** - `callNumber` (text input) **[REQUIRED]**
4. **Report Number** - `reportNumber` (text input) **[REQUIRED]**
5. **Responders Involved** - `responder1`, `responder2`, `responder3` (text inputs)
6. **Supervisor** - `supervisor` (text input) **[REQUIRED]**
7. **Primary PSM** - `primaryPSM` (text input)
8. **Time Notified** - `timeNotified` (text input, HH:MM army time) **[REQUIRED]**
9. **On Scene** - `onScene` (text input, HH:MM army time) **[REQUIRED]**
10. **Transport Arrived** - `transportArrived` (text input, HH:MM army time)
11. **Cleared Scene** - `clearedScene` (text input, HH:MM army time) **[REQUIRED]**
12. **Paramedics Called by** - `paramedicsCalledBy` (text input)
13. **First Agency on Scene** - `firstAgencyOnScene` (text input) **[REQUIRED]**

## Patient Information
14. **Patient Name** - `patientName` (text input) **[REQUIRED]**
15. **Date of Birth** - `dob` (date input)
16. **Age** - `age` (text input)
17. **Sex** - `sex` (radio buttons: Male, Female, Different from gender, Does not want to disclose, Other)
    - If Other: `otherSex` (text input)
18. **Status** - `status` (radio buttons: Student, Employee, Visitor/Other)
    - If Visitor/Other: `visitorText` (text input)
19. **Workplace Injury?** - `workplaceInjury` (radio buttons: Yes, No)
20. **Student/Employee Number** - `studentEmployeeNumber` (text input)
21. **Emergency Contact** - `emergencyContactName`, `emergencyContactPhone` (text inputs)
22. **Contacted?** - `contacted` (radio buttons: Yes, No)
23. **Contacted by** - `contactedBy` (text input)

## Patient Medical History
- **Chief Complaint** - `chiefComplaint` (textarea)
- **Signs and Symptoms** - `signsSymptoms` (textarea)
- **Allergies** - `allergies` (textarea)
- **Medications** - `medications` (textarea)
- **Pertinent Medical History** - `medicalHistory` (textarea)
- **Last Meal** - `lastMeal` (textarea)
- **Rapid Body Survey Findings** - `bodySurvey` (textarea)

## Treatment Performed
### Airway Management
- `airwayManagement[]` (checkboxes: Suctioning, Positioning, OPA, BVM, Pocket Mask, Other)
- If Other: `airwayManagementOther` (text input)

### CPR
- **Time Started** - `timeStarted` (text input)
- **Number of cycles** - `numberOfCycles` (text input)

### AED
- **Shocks (#)** - `numberOfShocks` (text input)
- **Shock Not Advised (#)** - `shockNotAdvised` (text input)

### Hemorrhage Control
- `hemorrhageControl[]` (checkboxes: Direct Pressure, Dressing, Tourniquet)

### Tourniquet
- **Time Applied** - `timeApplied` (text input)
- **Number of Turns** - `turnX` (text input)

### Immobilization
- `immobilization[]` (checkboxes: C-Collar, Splints, C-spine Manually Held)

### Position of Patient
- `positionOfPatient` (text input) **[REQUIRED]**

## OPQRST Assessment
- **Onset** - `onset` (text input)
- **Provocation** - `provocation` (text input)
- **Quality** - `quality` (text input)
- **Radiation** - `radiation` (text input)
- **Scale (1-10)** - `scale` (number input, 1-10)
- **Time** - `time` (time input)

## Injury Location
- **Injury Canvas** - `injuryCanvas` (canvas element for marking injuries)

## Vital Signs Table 1
Editable cells with IDs:
- **Time** - `time1` to `time6`
- **Pulse** - `pulse1` to `pulse6`
- **RESP** - `resp1` to `resp6`
- **B/P** - `bp1` to `bp6`
- **LOC** - `loc1` to `loc6`
- **Skin** - `skin1` to `skin6`

## Oxygen Protocol
- **Saturation Target Range** - `saturation_range` (radio: copd, other)
- **Initial SpO₂ %** - `spo2` (text input)
- **Initial SpO₂ Acceptable?** - `spo2_acceptable` (radio: yes, no)
- **Oxygen Therapy Given?** - `oxygen_given` (radio: yes, no)
- **Responders on Call** - `o2_supervisor`, `o2_responder1`, `o2_responder2`, `o2_responder3` (text inputs)
- **Reason for O2 Therapy** - `reasonForO2Therapy` (checkboxes: multiple options)
  - If Other: `reasonForO2TherapyOther` (text input)
- **Time Therapy Started** - `timeTherapyStarted` (time input)
- **Time Therapy Ended** - `timeTherapyEnded` (time input)
- **Flow Rate** - `flowRate` (text input)
- **Delivery Device** - `deliveryDevice` (radio: NC, NRB, BVM)

### Flow Rate Alterations Table
- **Time/Flow Rate pairs** - `frTime1`-`frTime6`, `frFlowRate1`-`frFlowRate6`

- **Reason for Ending Therapy** - `reasonForEndingTherapy` (textarea)
- **Who Started Therapy** - `whoStartedTherapy` (radio: Protection, VCRT, Lifeguard, Sports Services)

## Vital Signs Table 2 
Editable cells with IDs:
- **Time** - `v2_time1` to `v2_time6`
- **SPO2** - `spo21` to `spo26`

## Additional Information
- **Call Description** - `comments` (textarea) **[REQUIRED]**
- **Transfer of Care** - `transferComments` (textarea) **[REQUIRED]**
- **Patient Care Transferred** - `patientCareTransferred` (radio: Paramedics, Police, Self, Family/Friend, Clinic) **[REQUIRED]**
  - If Paramedics: `unitNumber` (text input)
- **Time Care Transferred** - `timeCareTransferred` (time input) **[REQUIRED]**

## Form Actions
- Submit button 
- Clear Form button
- Log Out button
