import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import React, { FC } from 'react';
import { BoardActionTypes, KanbanBoard } from './action';
import styled from 'styled-components';
import List from '../List';
import { Button } from 'antd';

const Container = styled.div`
    height: 100%;
    width: 100%;
    overflow-x: scroll;
    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
        background-color: #f5f5f5;
    }
    ::-webkit-scrollbar-thumb {
        border-radius: 8px;
        background-color: rgba(50, 50, 50, 0.3);
    }
    ::-webkit-scrollbar-track {
        border-radius: 8px;
        background-color: rgba(200, 200, 200, 0);
    }
`;

const ListContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-content: space-around;
`;

const ListPlaceholder = styled.div`
    margin: 4px;
    max-height: 4em;
    min-width: 200px;
    border-radius: 8px;
    border: 1px dashed rgba(0, 0, 0, 0.2);
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
`;

export interface InputProps {
    boardId: string;
    doesOnlyShowFocusedList?: boolean;
    showHeader?: boolean;
}

interface Props extends KanbanBoard, BoardActionTypes, InputProps {}
export const Board: FC<Props> = (props: Props) => {
    const handleDragEnd = ({ source, destination, type }: DropResult) => {
        // dropped outside the list
        if (!destination) {
            return;
        }
        if (type === 'COLUMN') {
            // Prevent update if nothing has changed
            if (source.index !== destination.index) {
                props.moveList(source.droppableId, source.index, destination.index);
            }
            return;
        }
        // Move card
        if (source.index !== destination.index || source.droppableId !== destination.droppableId) {
            props.moveCard(
                source.droppableId,
                destination.droppableId,
                source.index,
                destination.index
            );
        }
    };

    const addList = async () => {
        await props.addList(props._id, 'TestList');
    };

    const { doesOnlyShowFocusedList = false } = props;
    let lists;
    if (doesOnlyShowFocusedList) {
        lists = (provided: any) => (
            <ListContainer ref={provided.innerRef} {...provided.droppableProps}>
                <List listId={props.focusedList} index={0} key={0} boardId={props.boardId} />
                {provided.placeholder}
            </ListContainer>
        );
    } else {
        lists = (provided: any) => (
            <ListContainer ref={provided.innerRef}>
                {props.lists.map((listId, index) => (
                    <List
                        listId={listId}
                        index={index}
                        key={listId}
                        boardId={props.boardId}
                        focused={listId === props.focusedList}
                        done={listId === props.doneList}
                    />
                ))}
                {provided.placeholder}
                <ListPlaceholder>
                    <Button onClick={addList} icon={'plus'} shape="circle-outline" />
                </ListPlaceholder>
            </ListContainer>
        );
    }

    return (
        <Container>
            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId={props._id} type="COLUMN" direction="horizontal">
                    {lists}
                </Droppable>
            </DragDropContext>
        </Container>
    );
};
