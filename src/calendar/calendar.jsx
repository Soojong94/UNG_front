// MyCalendar.jsx
import React, { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../sidebar-02/sidebar';
import '../../src/App.css'
import Agenda from './../Agenda/Agenda';
import axios from 'axios';

const Calendar = ({ events }) => {
  const navigate = useNavigate();

  let clickTimeout = null;

  const [isAgendaVisible, setAgendaVisible] = useState(false);
  const [agendaEvents, setAgendaEvents] = useState([]);

  const handleDateClick = (selectInfo) => {
    if (clickTimeout !== null) {
      // 더블 클릭 발생
      clearTimeout(clickTimeout);
      clickTimeout = null;
      navigate(`/AddSchedule/${selectInfo.startStr}`);
    } else {
      // 첫 클릭 발생
      clickTimeout = setTimeout(() => {
        fetchAgendaEvents(selectInfo.startStr);
        setAgendaVisible(true);
        clickTimeout = null;
      }, 250); // 250ms 안에 또 클릭이 발생하면 더블 클릭으로 처리
    }
  }

  const fetchAgendaEvents = async (date) => {
    try {
      // 서버 요청 보내기
      const response = await axios.get(`/api/agenda/${date}`); // 예를 들어 '/api/agenda'는 서버에서 해당 날짜의 일정을 가져오는 엔드포인트일 것입니다.
  
      // 서버로부터 가져온 일정 데이터
      const agendaEventsData = response.data;
  
      // 가져온 일정 데이터를 agendaEvents state에 저장
      setAgendaEvents(agendaEventsData);
    } catch (error) {
      console.error('Error fetching agenda events:', error);
      // 오류 처리: 예를 들어 사용자에게 오류 메시지를 표시하거나 기타 조치를 취할 수 있습니다.
    }
  };

  const handleAgendaClose = () => {
    setAgendaVisible(false);
  }

  const handleEventClick = (arg) => {
    if (window.confirm(`삭제 하시겠습니까용가리 '${arg.event.title}'`)) {
      arg.event.remove();
    }
  }

  return (
    <div className='main_container'>
      <Sidebar />
      <div className = 'main_calendar'>

        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView='dayGridMonth'
          events={events}
          select={handleDateClick}
          eventClick={handleEventClick}
          selectable={true}
        />
      </div>
      {isAgendaVisible &&(
        <div className='calendar_agenda'>
          <Agenda events={agendaEvents} onclose={handleAgendaClose}/></div>

      )}
    </div>
  );
};

export default Calendar;
