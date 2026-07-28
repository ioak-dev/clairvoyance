CREATE INDEX idx_market_unit_name ON market_unit(name);
CREATE INDEX idx_consulting_unit_name ON consulting_unit(name);
CREATE INDEX idx_practice_area_name ON practice_area(name);
CREATE INDEX idx_competency_center_practice_area_id ON competency_center(practice_area_id);
CREATE INDEX idx_competency_center_name ON competency_center(name);
CREATE INDEX idx_site_name ON site(name);

CREATE INDEX idx_person_employee_id ON person(employee_id);
CREATE INDEX idx_person_status ON person(status);
CREATE INDEX idx_person_lifecycle_status ON person(lifecycle_status);
CREATE INDEX idx_person_consulting_unit_id ON person(consulting_unit_id);
CREATE INDEX idx_person_practice_area_id ON person(practice_area_id);
CREATE INDEX idx_person_competency_center_id ON person(competency_center_id);
CREATE INDEX idx_person_site_id ON person(site_id);
CREATE INDEX idx_person_manager_id ON person(manager_id);

CREATE INDEX idx_project_project_id ON project(project_id);
CREATE INDEX idx_project_reference_id ON project(reference_id);
CREATE INDEX idx_project_manager_id ON project(manager_id);
CREATE INDEX idx_project_market_unit_id ON project(market_unit_id);
CREATE INDEX idx_project_consulting_unit_id ON project(consulting_unit_id);
CREATE INDEX idx_project_win_probability ON project(win_probability);

CREATE INDEX idx_request_project_id ON request(project_id);
CREATE INDEX idx_request_person_id ON request(person_id);
CREATE INDEX idx_request_reference_id ON request(reference_id);
CREATE INDEX idx_request_status ON request(status);

CREATE INDEX idx_request_week_request ON request_week(request_id);
CREATE INDEX idx_request_week_year_week ON request_week(iso_year, iso_week);

CREATE INDEX idx_schedule_project_id ON schedule(project_id);
CREATE INDEX idx_schedule_person_id ON schedule(person_id);
CREATE INDEX idx_schedule_request_id ON schedule(request_id);

CREATE INDEX idx_schedule_week_schedule ON schedule_week(schedule_id);
CREATE INDEX idx_schedule_week_person ON schedule_week(person_id, iso_year, iso_week);
CREATE INDEX idx_schedule_week_project ON schedule_week(project_id, iso_year, iso_week);
CREATE INDEX idx_schedule_week_year_week ON schedule_week(iso_year, iso_week);

CREATE INDEX idx_vacation_person_id ON vacation(person_id);
CREATE INDEX idx_vacation_status ON vacation(status);
CREATE INDEX idx_vacation_dates ON vacation(start_date, end_date);

CREATE INDEX idx_project_filter_active_sort ON project_filter(is_active, sort_order);
CREATE INDEX idx_person_filter_active_sort ON person_filter(is_active, sort_order);
CREATE INDEX idx_request_filter_active_sort ON request_filter(is_active, sort_order);

CREATE INDEX idx_calendar_week_start ON calendar_week(week_start);
