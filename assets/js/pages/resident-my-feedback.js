const id=new URLSearchParams(location.search).get('id');
location.replace('resident-feedback.html'+(/^\d+$/.test(id||'')?'?id='+id:''));
