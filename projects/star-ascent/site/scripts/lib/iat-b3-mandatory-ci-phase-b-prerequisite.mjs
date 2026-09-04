#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const PHASE_B_PREREQUISITE_SCHEMA =
  "iat-b3-mandatory-ci-phase-b-prerequisite/v1";
export const PHASE_B_PREREQUISITE_VALIDATION_SCHEMA =
  "iat-b3-mandatory-ci-phase-b-prerequisite-validation/v1";
export const PHASE_B_PREREQUISITE_STATUS = "HOLD";
export const PHASE_B_PREREQUISITE_PACKET_SHA256 =
  "21c22dbf593b7b70c7f278e72b6704c18e6670ef1da1c610e304166386750b32";
export const PHASE_B_PREREQUISITE_PACKET_BYTES = 8303;

// This immutable copy makes module import a pure operation. The filesystem is
// consulted only by the explicit loader/CLI boundary below.
const EMBEDDED_CANONICAL_PACKET_BASE64 =
  "ewogICJzY2hlbWFTdGF0ZSI6IHsKICAgICJzY2hlbWEiOiAiaWF0LWIzLW1hbmRhdG9yeS1jaS1waGFzZS1iLXByZXJlcXVpc2l0ZS92MSIsCiAgICAic3RhdHVzIjogIkhPTEQiLAogICAgInJlYWR5IjogZmFsc2UsCiAgICAiY29tcGxldGUiOiBmYWxzZSwKICAgICJvcGVyYXRpdmUiOiBmYWxzZSwKICAgICJleGl0Q29kZSI6IDIKICB9LAogICJhdXRob3JpdHlTdGF0ZUJpbmRpbmciOiB7CiAgICAicGFja2V0IjogewogICAgICAicGF0aCI6ICJwcm9qZWN0cy9zdGFyLWFzY2VudC9zaXRlL2RvY3MvYjMvaWF0LWIzLW1hbmRhdG9yeS1jaS1waGFzZS1iLWF1dGhvcml0eS1zdGF0ZS52MS5qc29uIiwKICAgICAgInNoYTI1NiI6ICI2YjBiNTBkOWJjYzRhYTExMTZlMzNhNWUxY2RhN2ZlMDM5NzZlNTNiMjJmNzI1MjlkYTNmZjhjMjkxZDg5YjdjIiwKICAgICAgImJ5dGVMZW5ndGgiOiA1MTc1LAogICAgICAic2NoZW1hIjogImlhdC1iMy1waGFzZS1iLXAwMC1hdXRob3JpdHktc3RhdGUvdjEiCiAgICB9LAogICAgInZhbGlkYXRvciI6IHsKICAgICAgInBhdGgiOiAicHJvamVjdHMvc3Rhci1hc2NlbnQvc2l0ZS9zY3JpcHRzL3ZhbGlkYXRlLWlhdC1iMy1tYW5kYXRvcnktY2ktcGhhc2UtYi1hdXRob3JpdHktc3RhdGUubWpzIiwKICAgICAgInNoYTI1NiI6ICI2M2E5MWNlMDZlY2VlZmE0YzZmYjczN2FjMzYwZDlmNzFmZDdjYWY0MmViMzRiODk3OGNjOWYyMDYwMTMxOWZkIiwKICAgICAgImJ5dGVMZW5ndGgiOiAxMzk4NgogICAgfSwKICAgICJmb2N1c2VkVGVzdCI6IHsKICAgICAgInBhdGgiOiAicHJvamVjdHMvc3Rhci1hc2NlbnQvc2l0ZS90ZXN0cy9pYXQtYjMtbWFuZGF0b3J5LWNpLXBoYXNlLWItYXV0aG9yaXR5LXN0YXRlLnRlc3QubWpzIiwKICAgICAgInNoYTI1NiI6ICIxMjQ4NzgxMTgxMDUxYzMzY2Y0NTg3YjQ1N2UxYzJkMTExZjQzN2E5N2YyYzQwNGI0OGI3ZjU3ZDllZjFmNTYzIiwKICAgICAgImJ5dGVMZW5ndGgiOiAxNTgzMQogICAgfSwKICAgICJzdHJ1Y3R1cmFsU2VtYW50aWNEaWdlc3RTaGEyNTYiOiBudWxsLAogICAgImRlc2NyaXB0b3JCb3VuZCI6IHRydWUsCiAgICAicGh5c2ljYWxCeXRlc09ic2VydmVkIjogZmFsc2UsCiAgICAic2VtYW50aWNTdGF0ZU9ic2VydmVkIjogZmFsc2UsCiAgICAiZXhlY3V0aW9uRXZpZGVuY2UiOiBmYWxzZQogIH0sCiAgInNvdXJjZUNoZWNrcG9pbnRFeHBlY3RhdGlvbiI6IHsKICAgICJjb21taXRTaGEiOiBudWxsLAogICAgInRyZWVTaGEiOiBudWxsLAogICAgInNvdXJjZUNsb3N1cmVTaGEyNTYiOiBudWxsLAogICAgInJ1bm5lclNoYTI1NiI6IG51bGwsCiAgICAiY29udHJhY3RTaGEyNTYiOiBudWxsLAogICAgInBvbGljeVNoYTI1NiI6IG51bGwsCiAgICAiY2hlY2twb2ludE9ic2VydmVkIjogZmFsc2UKICB9LAogICJ3aW5kb3dzTGF1bmNoTG9ja0V4cGVjdGF0aW9uIjogewogICAgIm1vZGUiOiAiU09VUkNFX0JPVU5EX05BVElWRV9XSU5ET1dTX0xBVU5DSF9BTkRfTE9DSyIsCiAgICAic2VsZWN0ZWQiOiB0cnVlLAogICAgImltcGxlbWVudGVkIjogZmFsc2UsCiAgICAiY29tcGlsZWQiOiBmYWxzZSwKICAgICJjYXBhYmlsaXR5T2JzZXJ2ZWQiOiBmYWxzZSwKICAgICJleGVjdXRpb25BdXRob3JpemVkIjogZmFsc2UsCiAgICAicmVxdWlyZW1lbnRzIjogWwogICAgICAiQ09NTUlUVEVEX1NPVVJDRV9CT1VORF9OQVRJVkVfSU1QTEVNRU5UQVRJT04iLAogICAgICAiU0FNRV9PQkpFQ1RfT1BFTl9IQU5ETEVfREVOSUVTX1NIQVJFX1dSSVRFX0FORF9TSEFSRV9ERUxFVEUiLAogICAgICAiT1BFTl9IQU5ETEVfVk9MVU1FX0ZJTEVfSURfQU5EX1NIQTI1Nl9DUk9TU19CSU5EIiwKICAgICAgIlNUQVJUVVBJTkZPRVhfUFJPQ19USFJFQURfQVRUUklCVVRFX0pPQl9MSVNUIiwKICAgICAgIkNSRUFURV9TVVNQRU5ERURfQkVGT1JFX1JPT1RfRVhFQ1VUSU9OIiwKICAgICAgIkpPQl9LSUxMX09OX0NMT1NFX0FORF9CUkVBS0FXQVlfRElTQUJMRUQiLAogICAgICAiQ09NUExFVElPTl9QT1JUX0FDVElWRV9QUk9DRVNTX1pFUk8iCiAgICBdLAogICAgImZvcmJpZGRlbkZhbGxiYWNrcyI6IFsKICAgICAgIlBBVEhfT05MWV9IQVNIX1BMVVNfR0VORVJJQ19TUEFXTiIsCiAgICAgICJBU1NJR05fSk9CX0FGVEVSX1BST0NFU1NfU1RBUlQiLAogICAgICAiUElEX0VOVU1FUkFUSU9OX09SX1BJRF9SRVVTRV9DTEVBTlVQIiwKICAgICAgIlRBU0tLSUxMX1dNSV9DSU1fUFJPQ0VTU19OQU1FX0NMRUFOVVAiCiAgICBdCiAgfSwKICAidG9vbGNoYWluRXhwZWN0YXRpb25zIjogewogICAgImV4YWN0Tm9kZVJ1bnRpbWVMaXZlSWRlbnRpdHkiOiBudWxsLAogICAgInBpbm5lZFppZ0V4ZWN1dGFibGVJZGVudGl0eSI6IG51bGwsCiAgICAicGlubmVkWmlnVmVyc2lvbk91dHB1dCI6IG51bGwsCiAgICAibGludXhNdXNsQ29tcGlsZXJDbG9zdXJlIjogbnVsbCwKICAgICJsaW51eE11c2xTeXNyb290SWRlbnRpdHkiOiBudWxsLAogICAgIndpbmRvd3NHbnVDb21waWxlckNsb3N1cmUiOiBudWxsLAogICAgIndpbmRvd3NNaW5nd1N5c3Jvb3RJZGVudGl0eSI6IG51bGwsCiAgICAid2luZG93c1BlSW1wb3J0QWxsb3dsaXN0IjogbnVsbCwKICAgICJpZGVudGl0aWVzT2JzZXJ2ZWQiOiBmYWxzZSwKICAgICJhbGxSZXNvbHZlZCI6IGZhbHNlCiAgfSwKICAicGxhdGZvcm1DYXBhYmlsaXR5RXhwZWN0YXRpb25zIjogewogICAgImxpbnV4IjogewogICAgICAicGlkTmFtZXNwYWNlT2JzZXJ2ZWQiOiBmYWxzZSwKICAgICAgInBpZGZkT2JzZXJ2ZWQiOiBmYWxzZSwKICAgICAgInBkZWF0aHNpZ09ic2VydmVkIjogZmFsc2UsCiAgICAgICJwaWQxUmVhcGVyT2JzZXJ2ZWQiOiBmYWxzZSwKICAgICAgIm1vbm90b25pY1dhdGNoZG9nT2JzZXJ2ZWQiOiBmYWxzZQogICAgfSwKICAgICJ3aW5kb3dzIjogewogICAgICAic3RhcnR1cEluZm9FeEpvYkxpc3RPYnNlcnZlZCI6IGZhbHNlLAogICAgICAiY3JlYXRlU3VzcGVuZGVkT2JzZXJ2ZWQiOiBmYWxzZSwKICAgICAgImtpbGxPbkpvYkNsb3NlT2JzZXJ2ZWQiOiBmYWxzZSwKICAgICAgImJyZWFrYXdheURpc2FibGVkT2JzZXJ2ZWQiOiBmYWxzZSwKICAgICAgImNvbXBsZXRpb25Qb3J0QWN0aXZlUHJvY2Vzc1plcm9PYnNlcnZlZCI6IGZhbHNlCiAgICB9LAogICAgImFsbE9ic2VydmVkIjogZmFsc2UKICB9LAogICJoZWxwZXJBcnRpZmFjdEV4cGVjdGF0aW9ucyI6IHsKICAgICJzb3VyY2VDbG9zdXJlU2hhMjU2IjogbnVsbCwKICAgICJ3aW5kb3dzQXJ0aWZhY3RTaGEyNTYiOiBudWxsLAogICAgImxpbnV4QXJ0aWZhY3RTaGEyNTYiOiBudWxsLAogICAgIndpbmRvd3NDb21waWxlUmVjZWlwdFNoYTI1NiI6IG51bGwsCiAgICAibGludXhDb21waWxlUmVjZWlwdFNoYTI1NiI6IG51bGwsCiAgICAicnVudGltZVJlY2VpcHRTaGEyNTYiOiBudWxsLAogICAgImhlbHBlckNvbXBpbGVkIjogZmFsc2UsCiAgICAiYXJ0aWZhY3RzT2JzZXJ2ZWQiOiBmYWxzZSwKICAgICJjb21waWxlUmVjZWlwdHNPYnNlcnZlZCI6IGZhbHNlLAogICAgInJ1bnRpbWVSZWNlaXB0T2JzZXJ2ZWQiOiBmYWxzZQogIH0sCiAgImludm9jYXRpb25FbnZlbG9wZUV4cGVjdGF0aW9ucyI6IHsKICAgICJhcmd2UG9saWN5U2hhMjU2IjogbnVsbCwKICAgICJlbnZpcm9ubWVudFBvbGljeVNoYTI1NiI6IG51bGwsCiAgICAiY3dkUG9saWN5U2hhMjU2IjogbnVsbCwKICAgICJmZEhhbmRsZVBvbGljeVNoYTI1NiI6IG51bGwsCiAgICAiZGVhZGxpbmVQb2xpY3lTaGEyNTYiOiBudWxsLAogICAgInRhcFBvbGljeVNoYTI1NiI6IG51bGwsCiAgICAib3V0cHV0Q2FwUG9saWN5U2hhMjU2IjogbnVsbCwKICAgICJvYnNlcnZlZEludm9jYXRpb24iOiBmYWxzZQogIH0sCiAgInB1YmxpY0lucHV0QmluZGluZyI6IHsKICAgICJrNDRTdHJ1Y3R1cmFsQmluZGluZyI6IHsKICAgICAgImxpYnJhcnkiOiB7CiAgICAgICAgInBhdGgiOiAicHJvamVjdHMvc3Rhci1hc2NlbnQvc2l0ZS9zY3JpcHRzL2xpYi9pYXQtYjMta2V5LWZyZWUtcHVibGljLWJ1aWxkLWlucHV0Lm1qcyIsCiAgICAgICAgInNoYTI1NiI6ICIyOTZiYTk0NWYxODQyZTllMGVkZTAxNThjMzhkYTM5OTcwNjFiNDY1YTUxYTRhNjc1NzgyMTZlNDBhMmM4MGQwIiwKICAgICAgICAiYnl0ZUxlbmd0aCI6IDIzMDE3CiAgICAgIH0sCiAgICAgICJmb2N1c2VkVGVzdCI6IHsKICAgICAgICAicGF0aCI6ICJwcm9qZWN0cy9zdGFyLWFzY2VudC9zaXRlL3Rlc3RzL2lhdC1iMy1rZXktZnJlZS1wdWJsaWMtYnVpbGQtaW5wdXQudGVzdC5tanMiLAogICAgICAgICJzaGEyNTYiOiAiY2E3YWVlODE5N2M5YTkxODQxM2Y2ZmIzNWM1MThlZDRkZjJhNWEwNGNkZWNiY2NjYjg0M2QxYzY4OTQ2N2QzYiIsCiAgICAgICAgImJ5dGVMZW5ndGgiOiAxNzMzMwogICAgICB9LAogICAgICAiZG9jdW1lbnRhdGlvbiI6IHsKICAgICAgICAicGF0aCI6ICJwcm9qZWN0cy9zdGFyLWFzY2VudC9zaXRlL2RvY3MvYjMvS0VZX0ZSRUVfUFVCTElDX0JVSUxEX0lOUFVULm1kIiwKICAgICAgICAic2hhMjU2IjogImY5ZTY1ZTAyNGQyZTI2YzE5MjNkODEwZmM3ZmViYTgwYTRiNzU3ODhjZjIxMzY3MGVkY2Y2YjJhYTY2ODliNjUiLAogICAgICAgICJieXRlTGVuZ3RoIjogNDIwMQogICAgICB9LAogICAgICAidGVtcGxhdGUiOiB7CiAgICAgICAgInBhdGgiOiAicHJvamVjdHMvc3Rhci1hc2NlbnQvc2l0ZS9kb2NzL2IzL2lhdC1iMy1rZXktZnJlZS1wdWJsaWMtYnVpbGQtaW5wdXQudGVtcGxhdGUudjEuanNvbiIsCiAgICAgICAgInNoYTI1NiI6ICIxNzZhODU1ZThjNTNlOGE5YzVmNmM1NTU3NThlNjQxZTk4ZTZlYjFmNzE5ODIyMDQ0MmE2NTMxYWI0N2I4ODg0IiwKICAgICAgICAiYnl0ZUxlbmd0aCI6IDE5OTgKICAgICAgfSwKICAgICAgImRlc2NyaXB0b3JCb3VuZCI6IHRydWUsCiAgICAgICJzdHJ1Y3R1cmFsT25seSI6IHRydWUKICAgIH0sCiAgICAiZGlyZWN0T2JzZXJ2YXRpb25UcnV0aCI6IHsKICAgICAgImNoZWNrcG9pbnREaXJlY3RseU9ic2VydmVkQnlUaGlzTW9kdWxlIjogZmFsc2UsCiAgICAgICJ3YWxsQ2xvY2tEaXJlY3RseU9ic2VydmVkQnlUaGlzTW9kdWxlIjogZmFsc2UsCiAgICAgICJpbnB1dEZpbGVzRGlyZWN0bHlPYnNlcnZlZEJ5VGhpc01vZHVsZSI6IGZhbHNlLAogICAgICAicHJvZHVjdGlvbklkZW50aXR5SW52ZW50b3J5RGlyZWN0bHlPYnNlcnZlZEJ5VGhpc01vZHVsZSI6IGZhbHNlLAogICAgICAicHJpb3JMYW5lSWRlbnRpdHlJbnZlbnRvcnlEaXJlY3RseU9ic2VydmVkQnlUaGlzTW9kdWxlIjogZmFsc2UKICAgIH0sCiAgICAiYWxsRGlyZWN0T2JzZXJ2ZXJzT2JzZXJ2ZWQiOiBmYWxzZSwKICAgICJjYWxsZXJTdXBwbGllZEV2aWRlbmNlQWNjZXB0ZWQiOiBmYWxzZQogIH0sCiAgImRhZW1vblN0b3JhZ2VFeHBlY3RhdGlvbnMiOiB7CiAgICAiYTJTeXN0ZW1Qcm92aXNpb25pbmdBdXRob3JpemVkIjogZmFsc2UsCiAgICAic3lzdGVtUHJvdmlzaW9uaW5nT2JzZXJ2ZWQiOiBmYWxzZSwKICAgICJkYWVtb25BdmFpbGFibGUiOiBmYWxzZSwKICAgICJkYWVtb25JZGVudGl0eSI6IG51bGwsCiAgICAiZGFlbW9uU29ja2V0SWRlbnRpdHkiOiBudWxsLAogICAgImV4Y2x1c2l2ZVByaW5jaXBhbE9ic2VydmVkIjogZmFsc2UsCiAgICAic3RvcmFnZVJvb3QiOiBudWxsLAogICAgInN0b3JhZ2VSb290SWRlbnRpdHkiOiBudWxsLAogICAgInN0b3JhZ2VDYXBhY2l0eUJ5dGVzIjogbnVsbCwKICAgICJzdG9yYWdlQ2FwYWJpbGl0eU9ic2VydmVkIjogZmFsc2UsCiAgICAiZXhwZWN0ZWRVc2VDb3VudCI6IDAsCiAgICAib2JzZXJ2ZWRVc2VDb3VudCI6IG51bGwsCiAgICAidHJ1c3REZXJpdmVkIjogZmFsc2UKICB9LAogICJyZWNlaXB0U291cmNlUG9saWN5IjogewogICAgImF1dGhvcml0eSI6ICJPQlNFUlZFUl9PV05FRF9ESVJFQ1RfQllURVNfT05MWSIsCiAgICAib2JzZXJ2ZXJPd25lZFJlY2VpcHRzUmVxdWlyZWQiOiB0cnVlLAogICAgImNhbGxlclN1cHBsaWVkUmVjZWlwdEFjY2VwdGVkIjogZmFsc2UsCiAgICAic2VsZkRlY2xhcmVkUmVjZWlwdEFjY2VwdGVkIjogZmFsc2UsCiAgICAiaW5qZWN0ZWRSZWNlaXB0QWNjZXB0ZWQiOiBmYWxzZSwKICAgICJjb21waWxlQW5kUnVudGltZVJlY2VpcHRzU2VwYXJhdGUiOiB0cnVlLAogICAgInJlY2VpcHRTb3VyY2VPYnNlcnZlZCI6IGZhbHNlCiAgfSwKICAiYWJvcnRQb2xpY3kiOiB7CiAgICAiYW55R2FwRGlzcG9zaXRpb24iOiAiSE9MRCIsCiAgICAiZXhpdENvZGUiOiAyLAogICAgImF1dG9tYXRpY1JldHJ5QXV0aG9yaXplZCI6IGZhbHNlLAogICAgImZhbGxiYWNrQXV0aG9yaXplZCI6IGZhbHNlLAogICAgInJlc3VtZUF1dGhvcml6ZWQiOiBmYWxzZSwKICAgICJkZWFkbGluZU9yQ2FwYWNpdHlSZXNpemVBdXRob3JpemVkIjogZmFsc2UKICB9LAogICJ0cnV0aEVudmVsb3BlIjogewogICAgImhlbHBlckNvbXBpbGVkIjogZmFsc2UsCiAgICAiYnVpbGRFeGVjdXRlZCI6IGZhbHNlLAogICAgInJ1bnRpbWVFeGVjdXRlZCI6IGZhbHNlLAogICAgImRvY2tlclVzZWQiOiBmYWxzZSwKICAgICJuZXR3b3JrVXNlZCI6IGZhbHNlLAogICAgInJwY1VzZWQiOiBmYWxzZSwKICAgICJrZXlHZW5lcmF0ZWQiOiBmYWxzZSwKICAgICJzaWduZWQiOiBmYWxzZSwKICAgICJmdW5kZWQiOiBmYWxzZSwKICAgICJkZXBsb3llZCI6IGZhbHNlLAogICAgInB1YmxpY0Rldm5ldFJlcXVlc3RlZCI6IGZhbHNlLAogICAgInB1YmxpY0Rldm5ldEF1dGhvcml6ZWQiOiBmYWxzZSwKICAgICJtYWlubmV0QXV0aG9yaXplZCI6IGZhbHNlLAogICAgInJlbGVhc2VBdXRob3JpemVkIjogZmFsc2UKICB9LAogICJibG9ja2VycyI6IFsKICAgICJBMl9TWVNURU1fUFJPVklTSU9OSU5HX05PVF9BVVRIT1JJWkVEIiwKICAgICJCUDAwX1NUUlVDVFVSQUxfU0VNQU5USUNfRElHRVNUX1VOUkVTT0xWRUQiLAogICAgIkJQMDFfREFFTU9OX1NUT1JBR0VfT0JTRVJWQVRJT05fVU5BVkFJTEFCTEUiLAogICAgIkJQMDFfSEVMUEVSX0FSVElGQUNUX09CU0VSVkFUSU9OX1VOQVZBSUxBQkxFIiwKICAgICJCUDAxX0lOVk9DQVRJT05fRU5WRUxPUEVfT0JTRVJWQVRJT05fVU5BVkFJTEFCTEUiLAogICAgIkJQMDFfUExBVEZPUk1fQ0FQQUJJTElUWV9PQlNFUlZBVElPTl9VTkFWQUlMQUJMRSIsCiAgICAiQlAwMV9TT1VSQ0VfQ0hFQ0tQT0lOVF9VTk9CU0VSVkVEIiwKICAgICJCX0xPT1BCQUNLX1NJR05JTkdfR1JBTlRFRF9CVVRfSU5PUEVSQVRJVkUiLAogICAgIkNPTVBJTEVSX0VYRUNVVElPTl9OT1RfQVVUSE9SSVpFRCIsCiAgICAiRElSRUNUX0NIRUNLUE9JTlRfT0JTRVJWRVJfUkVRVUlSRURfQllfQ09OU1VNRVIiLAogICAgIkRJUkVDVF9JTlBVVF9GSUxFX09CU0VSVkVSX1JFUVVJUkVEX0JZX0NPTlNVTUVSIiwKICAgICJESVJFQ1RfUFJJT1JfTEFORV9JREVOVElUWV9JTlZFTlRPUllfT0JTRVJWRVJfUkVRVUlSRURfQllfQ09OU1VNRVIiLAogICAgIkRJUkVDVF9QUk9EVUNUSU9OX0lERU5USVRZX0lOVkVOVE9SWV9PQlNFUlZFUl9SRVFVSVJFRF9CWV9DT05TVU1FUiIsCiAgICAiRElSRUNUX1dBTExfQ0xPQ0tfT0JTRVJWRVJfUkVRVUlSRURfQllfQ09OU1VNRVIiLAogICAgIkVYQUNUX05PREVfUlVOVElNRV9MSVZFX0lERU5USVRZX1VOUkVTT0xWRUQiLAogICAgIkxJTlVYX01VU0xfQ09NUElMRVJfQ0xPU1VSRV9VTlJFU09MVkVEIiwKICAgICJMSU5VWF9NVVNMX1NZU1JPT1RfSURFTlRJVFlfVU5SRVNPTFZFRCIsCiAgICAiTkFUSVZFX0hFTFBFUl9FWEVDVVRJT05fTk9UX0FVVEhPUklaRUQiLAogICAgIk9CU0VSVkVSX09XTkVEX0RVQUxfQlVJTERfUkVDRUlQVF9VTkFWQUlMQUJMRSIsCiAgICAiUEhBU0VfQl9SVU5USU1FX0NPTlRBSU5NRU5UX0VYRUNVVElPTl9OT1RfQVVUSE9SSVpFRCIsCiAgICAiUElOTkVEX1pJR19FWEVDVVRBQkxFX0lERU5USVRZX1VOUkVTT0xWRUQiLAogICAgIlBJTk5FRF9aSUdfVkVSU0lPTl9PVVRQVVRfVU5SRVNPTFZFRCIsCiAgICAiU0FNRV9PQkpFQ1RfUlVOVElNRV9SRUNFSVBUX1VOQVZBSUxBQkxFIiwKICAgICJTT1VSQ0VfQk9VTkRfV0lORE9XU19MQVVOQ0hfTE9DS19OT1RfSU1QTEVNRU5URUQiLAogICAgIlNZU1RFTV9JTlNUQUxMX0RPV05MT0FEX05FVFdPUktfTk9UX0FVVEhPUklaRUQiLAogICAgIldJTkRPV1NfR05VX0NPTVBJTEVSX0NMT1NVUkVfVU5SRVNPTFZFRCIsCiAgICAiV0lORE9XU19NSU5HV19TWVNST09UX0lERU5USVRZX1VOUkVTT0xWRUQiLAogICAgIldJTkRPV1NfUEVfSU1QT1JUX0FMTE9XTElTVF9VTlJFU09MVkVEIgogIF0KfQo=";

const DEFAULT_PACKET_PATH = new URL(
  "../../docs/b3/iat-b3-mandatory-ci-phase-b-prerequisite.schema.v1.json",
  import.meta.url,
);

export const PHASE_B_PREREQUISITE_TOP_LEVEL_KEYS = Object.freeze([
  "schemaState",
  "authorityStateBinding",
  "sourceCheckpointExpectation",
  "windowsLaunchLockExpectation",
  "toolchainExpectations",
  "platformCapabilityExpectations",
  "helperArtifactExpectations",
  "invocationEnvelopeExpectations",
  "publicInputBinding",
  "daemonStorageExpectations",
  "receiptSourcePolicy",
  "abortPolicy",
  "truthEnvelope",
  "blockers",
]);

export const PHASE_B_PREREQUISITE_BLOCKERS = Object.freeze([
  "A2_SYSTEM_PROVISIONING_NOT_AUTHORIZED",
  "BP00_STRUCTURAL_SEMANTIC_DIGEST_UNRESOLVED",
  "BP01_DAEMON_STORAGE_OBSERVATION_UNAVAILABLE",
  "BP01_HELPER_ARTIFACT_OBSERVATION_UNAVAILABLE",
  "BP01_INVOCATION_ENVELOPE_OBSERVATION_UNAVAILABLE",
  "BP01_PLATFORM_CAPABILITY_OBSERVATION_UNAVAILABLE",
  "BP01_SOURCE_CHECKPOINT_UNOBSERVED",
  "B_LOOPBACK_SIGNING_GRANTED_BUT_INOPERATIVE",
  "COMPILER_EXECUTION_NOT_AUTHORIZED",
  "DIRECT_CHECKPOINT_OBSERVER_REQUIRED_BY_CONSUMER",
  "DIRECT_INPUT_FILE_OBSERVER_REQUIRED_BY_CONSUMER",
  "DIRECT_PRIOR_LANE_IDENTITY_INVENTORY_OBSERVER_REQUIRED_BY_CONSUMER",
  "DIRECT_PRODUCTION_IDENTITY_INVENTORY_OBSERVER_REQUIRED_BY_CONSUMER",
  "DIRECT_WALL_CLOCK_OBSERVER_REQUIRED_BY_CONSUMER",
  "EXACT_NODE_RUNTIME_LIVE_IDENTITY_UNRESOLVED",
  "LINUX_MUSL_COMPILER_CLOSURE_UNRESOLVED",
  "LINUX_MUSL_SYSROOT_IDENTITY_UNRESOLVED",
  "NATIVE_HELPER_EXECUTION_NOT_AUTHORIZED",
  "OBSERVER_OWNED_DUAL_BUILD_RECEIPT_UNAVAILABLE",
  "PHASE_B_RUNTIME_CONTAINMENT_EXECUTION_NOT_AUTHORIZED",
  "PINNED_ZIG_EXECUTABLE_IDENTITY_UNRESOLVED",
  "PINNED_ZIG_VERSION_OUTPUT_UNRESOLVED",
  "SAME_OBJECT_RUNTIME_RECEIPT_UNAVAILABLE",
  "SOURCE_BOUND_WINDOWS_LAUNCH_LOCK_NOT_IMPLEMENTED",
  "SYSTEM_INSTALL_DOWNLOAD_NETWORK_NOT_AUTHORIZED",
  "WINDOWS_GNU_COMPILER_CLOSURE_UNRESOLVED",
  "WINDOWS_MINGW_SYSROOT_IDENTITY_UNRESOLVED",
  "WINDOWS_PE_IMPORT_ALLOWLIST_UNRESOLVED",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function admitByteSource(value) {
  if (!ArrayBuffer.isView(value)) return null;
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (Object.getPrototypeOf(value) !== Uint8Array.prototype) return null;
  return Buffer.from(value);
}

export function parsePhaseBPrerequisiteJson(
  text,
  label = "phase-b-prerequisite",
) {
  if (typeof text !== "string") {
    throw new TypeError(`${label}: JSON source must be a string`);
  }
  let index = 0;
  const skipWhitespace = () => {
    while (index < text.length && /[\t\n\r ]/u.test(text[index])) index += 1;
  };
  const fail = (message) => {
    throw new SyntaxError(`${label}: ${message} at character ${index}`);
  };
  const parseString = () => {
    if (text[index] !== "\"") fail("expected JSON string");
    const start = index;
    index += 1;
    while (index < text.length) {
      if (text[index] === "\"") {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      if (text[index] === "\\") index += 2;
      else {
        if (text[index] < " ") fail("unescaped control character");
        index += 1;
      }
    }
    fail("unterminated JSON string");
  };
  const parseValue = (path) => {
    skipWhitespace();
    if (text[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      while (index < text.length) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) {
          throw new SyntaxError(`${label}: duplicate JSON member ${path}.${key}`);
        }
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") fail("expected colon");
        index += 1;
        parseValue(`${path}.${key}`);
        skipWhitespace();
        if (text[index] === "}") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing brace");
        index += 1;
      }
      fail("unterminated JSON object");
    }
    if (text[index] === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      let item = 0;
      while (index < text.length) {
        parseValue(`${path}[${item}]`);
        item += 1;
        skipWhitespace();
        if (text[index] === "]") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing bracket");
        index += 1;
      }
      fail("unterminated JSON array");
    }
    if (text[index] === "\"") {
      parseString();
      return;
    }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) fail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skipWhitespace();
  parseValue("$root");
  skipWhitespace();
  if (index !== text.length) fail("unexpected trailing data");
  return JSON.parse(text);
}

export function parsePhaseBPrerequisiteBytes(
  packetBytes,
  label = "phase-b-prerequisite",
) {
  const bytes = admitByteSource(packetBytes);
  if (bytes === null) {
    throw new TypeError(`${label}: raw Buffer or Uint8Array source is required`);
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new SyntaxError(`${label}: UTF-8 BOM is forbidden`);
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return parsePhaseBPrerequisiteJson(text, label);
}

function compareCanonical(actual, expected, label, violations) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      violations.push(`${label}: expected an array`);
      return;
    }
    if (actual.length !== expected.length) {
      violations.push(`${label}: expected exactly ${expected.length} entries`);
      return;
    }
    for (let index = 0; index < expected.length; index += 1) {
      compareCanonical(actual[index], expected[index], `${label}[${index}]`, violations);
    }
    return;
  }
  if (isPlainRecord(expected)) {
    if (!isPlainRecord(actual)) {
      violations.push(`${label}: expected a plain object`);
      return;
    }
    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);
    if (actualKeys.length !== expectedKeys.length
      || actualKeys.some((key, index) => key !== expectedKeys[index])) {
      violations.push(`${label}: expected exact ordered keys ${expectedKeys.join(", ")}`);
      return;
    }
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(actual, key);
      if (descriptor === undefined || "get" in descriptor || "set" in descriptor) {
        violations.push(`${label}.${key}: accessors are forbidden`);
        continue;
      }
      compareCanonical(descriptor.value, expected[key], `${label}.${key}`, violations);
    }
    return;
  }
  if (!Object.is(actual, expected)) {
    violations.push(`${label}: expected ${JSON.stringify(expected)}`);
  }
}

const embeddedCanonicalPacketBytes = Buffer.from(
  EMBEDDED_CANONICAL_PACKET_BASE64,
  "base64",
);
if (embeddedCanonicalPacketBytes.length !== PHASE_B_PREREQUISITE_PACKET_BYTES
  || sha256(embeddedCanonicalPacketBytes) !== PHASE_B_PREREQUISITE_PACKET_SHA256) {
  throw new Error("embedded Phase-B prerequisite packet physical descriptor mismatch");
}

export const PHASE_B_PREREQUISITE_EXPECTED = deepFreeze(
  parsePhaseBPrerequisiteBytes(embeddedCanonicalPacketBytes, "embedded canonical packet"),
);

export function loadPhaseBPrerequisiteBytes() {
  return readFileSync(DEFAULT_PACKET_PATH);
}

function buildResult(violations, sourceBytesValidated = false) {
  const valid = violations.length === 0;
  return {
    schema: PHASE_B_PREREQUISITE_VALIDATION_SCHEMA,
    valid,
    status: PHASE_B_PREREQUISITE_STATUS,
    ready: false,
    complete: false,
    operative: false,
    exitCode: 2,
    sourceBytesValidated: valid && sourceBytesValidated,
    authorityDescriptorBound: valid,
    k44StructuralDescriptorBound: valid,
    structuralSemanticDigestResolved: false,
    checkpointObserved: false,
    toolchainIdentitiesResolved: false,
    platformCapabilitiesObserved: false,
    helperArtifactObserved: false,
    invocationObserved: false,
    k44DirectObserversObserved: false,
    daemonStorageObserved: false,
    compilerExecutionAuthorized: false,
    nativeHelperExecutionAuthorized: false,
    runtimeContainmentExecutionAuthorized: false,
    buildExecuted: false,
    runtimeExecuted: false,
    dockerUsed: false,
    networkUsed: false,
    rpcUsed: false,
    keyGenerated: false,
    signed: false,
    funded: false,
    deployed: false,
    publicDevnetRequested: false,
    publicDevnetAuthorized: false,
    mainnetAuthorized: false,
    releaseAuthorized: false,
    blockers: [...PHASE_B_PREREQUISITE_BLOCKERS],
    violations,
  };
}

export function validatePhaseBPrerequisiteBytes(packetBytes) {
  const bytes = admitByteSource(packetBytes);
  if (bytes === null) {
    return buildResult(["packetBytes: raw Buffer or Uint8Array source is required"]);
  }
  const violations = [];
  const sourceBytesValidated = bytes.length === PHASE_B_PREREQUISITE_PACKET_BYTES
    && sha256(bytes) === PHASE_B_PREREQUISITE_PACKET_SHA256;
  if (bytes.length !== PHASE_B_PREREQUISITE_PACKET_BYTES) {
    violations.push(`packetBytes: expected exact length ${PHASE_B_PREREQUISITE_PACKET_BYTES}`);
  }
  if (sha256(bytes) !== PHASE_B_PREREQUISITE_PACKET_SHA256) {
    violations.push("packetBytes: source-bound SHA-256 mismatch");
  }
  let packet;
  try {
    packet = parsePhaseBPrerequisiteBytes(bytes);
  } catch (error) {
    violations.push(error instanceof Error ? error.message : String(error));
  }
  if (packet !== undefined) {
    compareCanonical(packet, PHASE_B_PREREQUISITE_EXPECTED, "packet", violations);
    const keys = isPlainRecord(packet) ? Object.keys(packet) : [];
    if (keys.length !== PHASE_B_PREREQUISITE_TOP_LEVEL_KEYS.length
      || keys.some((key, index) => key !== PHASE_B_PREREQUISITE_TOP_LEVEL_KEYS[index])) {
      violations.push("packet: top-level schema order is not canonical");
    }
    if (!Array.isArray(packet.blockers)
      || packet.blockers.length !== PHASE_B_PREREQUISITE_BLOCKERS.length
      || new Set(packet.blockers).size !== PHASE_B_PREREQUISITE_BLOCKERS.length
      || packet.blockers.some(
        (blocker, index) => blocker !== PHASE_B_PREREQUISITE_BLOCKERS[index],
      )) {
      violations.push("packet.blockers: expected exact unique sorted 28-member list");
    }
  }
  return buildResult(violations, sourceBytesValidated);
}

function main() {
  if (process.argv.length !== 2) {
    console.error("usage: iat-b3-mandatory-ci-phase-b-prerequisite.mjs");
    process.exitCode = 1;
    return;
  }
  try {
    const result = validatePhaseBPrerequisiteBytes(loadPhaseBPrerequisiteBytes());
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.valid ? 2 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
