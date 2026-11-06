(function(root) {
  'use strict';
  // Only server-confirmed membership or an email-matched invite can select a calendar.
  root.findUserCalendar = async function({user,remembered,readMembership,findMemberships,findInvites,acceptInvite,isCurrent}) {
    if(!user?.emailVerified)return null;
    const current=()=>{if(!isCurrent())throw new Error('Kirjautuminen vaihtui. Kirjaudu uudelleen.');};
    if(remembered){
      try {
        const member=await readMembership(remembered,user.uid);current();
        if(member?.active)return remembered;
      } catch(error){if(error.code!=='permission-denied')throw error;}
    }
    const memberships=await findMemberships(user.email);current();
    const own=memberships.filter(member=>member.uid===user.uid&&member.active&&member.calendarId).sort((a,b)=>a.calendarId.localeCompare(b.calendarId));
    if(own.length)return own[0].calendarId;
    const invites=await findInvites(user.email);current();
    const pending=invites.filter(invite=>invite.active&&invite.calendarId&&invite.code).sort((a,b)=>a.calendarId.localeCompare(b.calendarId));
    if(!pending.length)return null;
    await acceptInvite(pending[0].calendarId,pending[0].code);current();
    return pending[0].calendarId;
  };
})(typeof window!=='undefined'?window:globalThis);
